/**
 * Lecture d'une packing list fournisseur — logique pure.
 *
 * Ce module ne dépend ni de React, ni de Supabase, ni d'`xlsx` : il reçoit une
 * feuille déjà lue via `fromWorksheet`, typée structurellement. C'est ce qui
 * lui permet d'être testé sur les vrais fichiers sans embarquer le lecteur
 * Excel dans le bundle de production (seul le chunk chargé dynamiquement par
 * `packingImportMock.ts` importe `xlsx-js-style`).
 *
 * ┌─ LE DOCUMENT RÉEL ────────────────────────────────────────────────────────┐
 * │   CONTENEUR GR 153                          ← titre, ligne 1             │
 * │   ITEM # │ DESCRIPTION │ (*) │ KGS │ PCS │ QTY │ TOTAL PCS/KG   ← ligne 3│
 * │      1   │ POLO T-SHIRT│     │     │ 200 │  20 │ 4000                    │
 * │     12   │ LADIES CORSET     │  25 │ KGS │   3 │   75                    │
 * │                                          │ 548 │              ← totaux   │
 * │   TOTAL : 548 - PACKAGES (MIXED USED CLOTHING)             ← pied de page │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * QTY est le nombre de COLIS : la seule grandeur additive, et la seule que le
 * fournisseur totalise lui-même. KGS ou PCS décrit le contenu d'UN colis selon
 * le régime de la ligne. TOTAL PCS/KG mélange pièces et kilos dans une même
 * colonne — il ne se somme jamais.
 *
 * Sept pièges relevés sur CONTENEUR GR153 et GR154, tous traités ici. Toute
 * réimplémentation (le service Go en premier lieu) doit repasser
 * `packingDocument.test.ts`, qui les fige sur les deux fichiers réels.
 *
 *  1. La ligne d'en-tête n'est pas à une position fixe : on la cherche par le
 *     marqueur « ITEM # ».
 *  2. La feuille n'a pas de nom stable : GR153 dit « Invoice », GR154
 *     « Sheet1 ». On lit la première feuille et on trace laquelle.
 *  3. Les cellules ITEM #/DESCRIPTION sont FUSIONNÉES quand un article se
 *     décline en plusieurs conditionnements : 7 articles de GR153 s'étalent
 *     sur 2 ou 3 lignes. Sans report vers le bas, 9 lignes perdent leur
 *     libellé.
 *  4. ITEM # n'est pas une clé : GR153 numérote `9` deux articles différents
 *     (lignes 13 et 14) et décale toute la suite. Il ne sert qu'au diagnostic.
 *  5. Le littéral « KGS » peut se trouver dans la colonne PCS (GR153 ligne 17)
 *     pendant que la colonne KGS porte le nombre.
 *  6. La ligne de totaux et le pied de page textuel ne sont pas des articles.
 *     Ils portent le nombre de colis déclaré — la valeur la plus utile du
 *     document, celle qui permet de contrôler le fichier contre lui-même.
 *  7. `!ref` ne dit pas les colonnes utiles : GR154 déclare A1:M146 avec H à M
 *     entièrement vides.
 *
 * La colonne sans en-tête qui porte « (*) » est ignorée : décision du
 * demandeur, ce marqueur n'a pas de sens métier.
 */

import { normalizePackingLabel, PACKING_NORMALIZER_VERSION } from "./packingGrouping"

// ── Abstraction de feuille ────────────────────────────────────────────────────

export type PackingCellValue = string | number | boolean | Date | null | undefined

/** Une plage fusionnée, en indices 0-basés (convention `xlsx`). */
export interface PackingMerge {
    s: { r: number; c: number }
    e: { r: number; c: number }
}

/** Grille lue, en indices 0-basés. */
export interface PackingSheet {
    name: string
    rowCount: number
    colCount: number
    merges: readonly PackingMerge[]
    cell(row: number, col: number): PackingCellValue
}

/**
 * Forme structurelle d'une feuille `xlsx-js-style`, décrite ici pour ne pas
 * importer ses types : `{ "!ref": "A1:G105", "!merges": [...], A1: { v } }`.
 */
export interface RawWorksheet {
    "!ref"?: string
    "!merges"?: PackingMerge[]
    [address: string]: unknown
}

const A = "A".charCodeAt(0)

export function encodeCol(col: number): string {
    let rest = col
    let out = ""
    do {
        out = String.fromCharCode(A + (rest % 26)) + out
        rest = Math.floor(rest / 26) - 1
    } while (rest >= 0)
    return out
}

function decodeCol(letters: string): number {
    let col = 0
    for (const ch of letters) col = col * 26 + (ch.charCodeAt(0) - A + 1)
    return col - 1
}

/** Adapte une feuille `xlsx-js-style` sans dépendre de la bibliothèque. */
export function fromWorksheet(name: string, ws: RawWorksheet): PackingSheet {
    const ref = typeof ws["!ref"] === "string" ? ws["!ref"] : "A1:A1"
    const end = ref.split(":")[1] ?? ref.split(":")[0] ?? "A1"
    const parsed = /^([A-Z]+)(\d+)$/.exec(end)
    const colCount = parsed ? decodeCol(parsed[1]) + 1 : 1
    const rowCount = parsed ? Number(parsed[2]) : 1

    return {
        name,
        rowCount,
        colCount,
        merges: ws["!merges"] ?? [],
        cell(row, col) {
            const raw = ws[`${encodeCol(col)}${row + 1}`]
            if (raw === null || raw === undefined || typeof raw !== "object") return null
            return (raw as { v?: PackingCellValue }).v ?? null
        },
    }
}

// ── Modèle du document ───────────────────────────────────────────────────────

export type PackingUnitKind = "pcs" | "kgs"

export interface PackingDocumentLine {
    /** Rang dans le document, 0-basé : alimente `position`. */
    position: number
    /** Ligne Excel 1-basée : alimente `source_row`, pour pointer l'original. */
    sourceRow: number
    /** Libellé tel qu'écrit, report des fusions compris. Jamais réécrit. */
    rawLabel: string
    /** Clé de regroupement, produite par le normaliseur partagé. */
    rawLabelKey: string
    /** Colonne QTY : nombre de colis. */
    packageCount: number | null
    /** Contenu d'un colis, dans l'unité de `unitKind`. */
    unitsPerPackage: number | null
    unitKind: PackingUnitKind | null
    /** Colonne TOTAL PCS/KG telle que lue, sans recalcul. */
    declaredTotal: number | null
    /** Toutes les colonnes de la ligne, pour la traçabilité (`raw_row`). */
    rawRow: Record<string, unknown>
}

export interface PackingDocument {
    /** Nom de la feuille effectivement lue. */
    sheetName: string
    /** Titre lu au-dessus de l'en-tête (« CONTENEUR GR 153 »), ou `null`. */
    containerLabel: string | null
    /** Nombre de colis déclaré par le fichier : ligne de totaux, sinon pied de page. */
    declaredPackageCount: number | null
    /** Somme des colis effectivement lus sur les lignes. */
    totalPackages: number
    lines: PackingDocumentLine[]
    anomalies: PackingAnomaly[]
}

export type PackingAnomalyKind =
    /** `unitsPerPackage × packageCount` ne donne pas `declaredTotal`. */
    | "row_math"
    /** La colonne TOTAL est vide alors que le calcul était possible. */
    | "row_total_missing"
    /** Ni nombre de colis, ni unité : la ligne ne se compte pas. */
    | "row_incomplete"
    /** Σ colis des lignes ≠ total déclaré par le fichier. */
    | "file_package_count"
    /** La ligne de totaux et le pied de page ne disent pas la même chose. */
    | "footer_mismatch"
    /** Le titre du fichier ne correspond pas au conteneur de l'arrivage. */
    | "container_mismatch"

export interface PackingAnomaly {
    kind: PackingAnomalyKind
    /** Ligne Excel 1-basée, ou `null` pour une anomalie portant sur le fichier. */
    sourceRow: number | null
    /** Message prêt à afficher, en français. */
    message: string
}

export class PackingParseError extends Error {}

// ── Lecture ──────────────────────────────────────────────────────────────────

const HEADER_MARKER = /^item\b/
/** Au-delà, ce n'est plus un en-tête mais une ligne de données mal lue. */
const HEADER_SEARCH_ROWS = 30

type ColumnRole = "item" | "description" | "kgs" | "pcs" | "qty" | "total"

const ROLE_PATTERNS: ReadonlyArray<[ColumnRole, RegExp]> = [
    ["item", /^item/],
    ["description", /^(description|designation|article|libelle)/],
    // Avant `total`, sinon « TOTAL PCS/KG » serait pris pour la colonne PCS.
    ["total", /^total/],
    ["kgs", /^kgs?$/],
    ["pcs", /^(pcs|pieces?)$/],
    ["qty", /^(qty|quantity|quantite)$/],
]

function text(value: PackingCellValue): string | null {
    if (value === null || value === undefined) return null
    if (value instanceof Date) return null
    const s = String(value).trim()
    return s === "" ? null : s
}

/**
 * Un nombre de cellule — y compris écrit en TEXTE.
 *
 * GR153 et GR154 portent tous leurs nombres en cellules numériques, mais c'est
 * une propriété de ces deux fichiers, pas du format : une colonne saisie à la
 * main, collée depuis un PDF ou exportée par un autre outil arrive en texte, et
 * la ligne perdait alors SILENCIEUSEMENT son poids, sa quantité et son total —
 * elle ne devenait ni une anomalie ni un zéro, juste une ligne vide de chiffres.
 *
 * La tolérance s'arrête aux chiffres et aux séparateurs. Un texte comme « KGS »
 * ou « 45 KG » n'est jamais un nombre : le littéral « KGS » vit dans la colonne
 * PCS sur GR153 (piège n° 5), et le lire comme une quantité inventerait une
 * ligne en pièces là où le fichier parle de kilos.
 */
function numeric(value: PackingCellValue): number | null {
    if (typeof value === "number") return Number.isFinite(value) ? value : null
    if (typeof value !== "string") return null

    const raw = value.trim()
    if (raw === "" || !/^[\d\s.,']*\d[\d\s.,']*$/.test(raw)) return null

    // Espaces et apostrophes ne séparent jamais que des milliers.
    let body = raw.replace(/[\s']/g, "")
    const lastComma = body.lastIndexOf(",")
    const lastDot = body.lastIndexOf(".")

    if (lastComma >= 0 && lastDot >= 0) {
        // Les deux présents : le DERNIER est la décimale, l'autre les milliers.
        const decimal = lastComma > lastDot ? "," : "."
        body = body.replace(new RegExp(`\\${decimal === "," ? "." : ","}`, "g"), "")
        body = body.replace(decimal, ".")
    } else if (lastComma >= 0) {
        // Une virgule seule : « 1,200 » est un millier (usage du fournisseur,
        // anglophone), « 1,5 » une décimale. Trois chiffres exactement derrière
        // tranchent, c'est la seule lecture qui ne perde jamais un facteur 1000.
        body = /,\d{3}$/.test(body) ? body.replace(/,/g, "") : body.replace(",", ".")
    }

    const parsed = Number(body)
    return Number.isFinite(parsed) ? parsed : null
}

interface Header {
    row: number
    col: number
    roles: Map<ColumnRole, number>
    labels: string[]
}

function findHeader(sheet: PackingSheet): Header {
    const limit = Math.min(sheet.rowCount, HEADER_SEARCH_ROWS)
    for (let r = 0; r < limit; r++) {
        for (let c = 0; c < sheet.colCount; c++) {
            const value = text(sheet.cell(r, c))
            if (!value || !HEADER_MARKER.test(value.toLowerCase())) continue

            const roles = new Map<ColumnRole, number>()
            const labels: string[] = []
            for (let k = c; k < sheet.colCount; k++) {
                const label = text(sheet.cell(r, k))
                labels.push(label ?? "")
                if (!label) continue
                const key = label.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
                for (const [role, pattern] of ROLE_PATTERNS) {
                    if (!roles.has(role) && pattern.test(key)) {
                        roles.set(role, k)
                        break
                    }
                }
            }
            if (roles.has("description")) return { row: r, col: c, roles, labels }
        }
    }
    throw new PackingParseError(
        "En-tête « ITEM # / DESCRIPTION » introuvable : ce fichier n'a pas la forme d'une packing list.",
    )
}

/**
 * Valeur d'une cellule, en remontant à l'origine de sa plage fusionnée.
 * C'est ce qui rend son libellé aux lignes de continuation d'un article.
 */
function mergedValue(sheet: PackingSheet, row: number, col: number): PackingCellValue {
    const own = sheet.cell(row, col)
    if (text(own) !== null || numeric(own) !== null) return own
    for (const m of sheet.merges) {
        if (col >= m.s.c && col <= m.e.c && row > m.s.r && row <= m.e.r) {
            return sheet.cell(m.s.r, m.s.c)
        }
    }
    return null
}

/** Titre du document : première cellule texte au-dessus de l'en-tête. */
function findContainerLabel(sheet: PackingSheet, header: Header): string | null {
    for (let r = 0; r < header.row; r++) {
        for (let c = 0; c < sheet.colCount; c++) {
            const value = text(sheet.cell(r, c))
            if (value) return value
        }
    }
    return null
}

const FOOTER_TOTAL = /total\s*:?\s*([\d\s.,]+)/i

function parseFooterCount(value: string): number | null {
    const match = FOOTER_TOTAL.exec(value)
    if (!match) return null
    const digits = match[1].replace(/[^\d]/g, "")
    if (digits === "") return null
    const n = Number(digits)
    return Number.isFinite(n) ? n : null
}

export function parsePackingDocument(sheet: PackingSheet): PackingDocument {
    const header = findHeader(sheet)
    const col = (role: ColumnRole): number | null => header.roles.get(role) ?? null

    const iDesc = col("description")
    const iKgs = col("kgs")
    const iPcs = col("pcs")
    const iQty = col("qty")
    const iTotal = col("total")
    const iItem = col("item")

    const lines: PackingDocumentLine[] = []
    const anomalies: PackingAnomaly[] = []
    let totalsRowCount: number | null = null
    let footerCount: number | null = null

    for (let r = header.row + 1; r < sheet.rowCount; r++) {
        const sourceRow = r + 1

        // Pied de page textuel : « TOTAL : 548 - PACKAGES (MIXED USED CLOTHING) ».
        // Il vit dans la colonne ITEM #, là où un article serait attendu.
        let footerText: string | null = null
        for (let c = header.col; c < sheet.colCount; c++) {
            const value = text(sheet.cell(r, c))
            if (value && /^total\b/i.test(value)) {
                footerText = value
                break
            }
        }
        if (footerText) {
            footerCount = parseFooterCount(footerText) ?? footerCount
            continue
        }

        const label = iDesc === null ? null : text(mergedValue(sheet, r, iDesc))
        const qty = iQty === null ? null : numeric(sheet.cell(r, iQty))

        // Ligne de totaux : pas de libellé, mais un nombre de colis. C'est le
        // total que le fournisseur additionne lui-même.
        if (!label) {
            if (qty !== null) totalsRowCount = qty
            continue
        }

        const kgs = iKgs === null ? null : numeric(sheet.cell(r, iKgs))
        const pcs = iPcs === null ? null : numeric(sheet.cell(r, iPcs))

        // La colonne KGS renseignée décide du régime, que le littéral « KGS »
        // soit dans sa propre colonne ou dans celle des pièces.
        const unitKind: PackingUnitKind | null = kgs !== null ? "kgs" : pcs !== null ? "pcs" : null
        const unitsPerPackage = kgs !== null ? kgs : pcs

        const rawRow: Record<string, unknown> = {}
        for (let k = header.col; k < sheet.colCount; k++) {
            const columnLabel = header.labels[k - header.col] || encodeCol(k)
            const value = sheet.cell(r, k)
            if (value !== null && value !== undefined) rawRow[columnLabel] = value
        }
        if (iItem !== null) {
            // Reporté depuis la fusion, et conservé pour le seul diagnostic :
            // ce numéro est dupliqué dans GR153, il n'identifie rien.
            const item = mergedValue(sheet, r, iItem)
            if (item !== null && item !== undefined) rawRow["ITEM #"] = item
        }

        lines.push({
            position: lines.length,
            sourceRow,
            rawLabel: label,
            rawLabelKey: normalizePackingLabel(label),
            packageCount: qty,
            unitsPerPackage,
            unitKind,
            declaredTotal: iTotal === null ? null : numeric(sheet.cell(r, iTotal)),
            rawRow,
        })
    }

    if (lines.length === 0) {
        throw new PackingParseError("Aucune ligne de marchandise n'a été trouvée sous l'en-tête.")
    }

    const totalPackages = lines.reduce((sum, l) => sum + (l.packageCount ?? 0), 0)
    const declaredPackageCount = totalsRowCount ?? footerCount

    if (totalsRowCount !== null && footerCount !== null && totalsRowCount !== footerCount) {
        anomalies.push({
            kind: "footer_mismatch",
            sourceRow: null,
            message: `Le fichier s'annonce à ${footerCount} colis en pied de page mais totalise ${totalsRowCount} dans la colonne QTY.`,
        })
    }

    for (const line of lines) {
        if (line.packageCount === null || line.unitsPerPackage === null) {
            anomalies.push({
                kind: "row_incomplete",
                sourceRow: line.sourceRow,
                message: `« ${line.rawLabel} » : nombre de colis ou contenu par colis manquant.`,
            })
            continue
        }
        const expected = line.unitsPerPackage * line.packageCount
        if (line.declaredTotal === null) {
            anomalies.push({
                kind: "row_total_missing",
                sourceRow: line.sourceRow,
                message: `« ${line.rawLabel} » : total absent du fichier (attendu ${formatAmount(expected)}).`,
            })
        } else if (Math.abs(line.declaredTotal - expected) > 0.001) {
            anomalies.push({
                kind: "row_math",
                sourceRow: line.sourceRow,
                message: `« ${line.rawLabel} » : le fichier annonce ${formatAmount(line.declaredTotal)} au lieu de ${formatAmount(expected)}.`,
            })
        }
    }

    if (declaredPackageCount !== null && declaredPackageCount !== totalPackages) {
        const diff = totalPackages - declaredPackageCount
        anomalies.push({
            kind: "file_package_count",
            sourceRow: null,
            message: `${totalPackages} colis sur les lignes contre ${declaredPackageCount} annoncés par le fichier (${diff > 0 ? "+" : "−"}${Math.abs(diff)}).`,
        })
    }

    return {
        sheetName: sheet.name,
        containerLabel: findContainerLabel(sheet, header),
        declaredPackageCount,
        totalPackages,
        lines,
        anomalies,
    }
}

function formatAmount(value: number): string {
    return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

// ── Rapprochement du conteneur ───────────────────────────────────────────────

/** Majuscules, sans séparateur : « CONTENEUR GR 153 » → « CONTENEURGR153 ». */
export function normalizeContainerRef(value: string): string {
    return value.toUpperCase().replace(/[^A-Z0-9]/g, "")
}

/** Suites de chiffres d'une référence : « CONTENEUR GR 153 » → `["153"]`. */
function digitRuns(value: string): string[] {
    return (value.match(/\d{2,}/g) ?? []).map((run) => run.replace(/^0+(?=\d)/, ""))
}

/** Les deux références qu'un arrivage porte sur un conteneur. */
export interface ContainerRefs {
    /**
     * `conteneur_no_raw` — le n° INTERNE (« GR 123 », « INDE 456 »). C'est la
     * référence que le fournisseur écrit en tête de sa packing list, donc la
     * seule qui puisse trancher.
     */
    internalRef: string | null
    /** `container_no` — le n° ISO du conteneur (« CSLU6080095 »). */
    containerNo: string | null
}

/**
 * Le titre du fichier parle-t-il bien du conteneur de cet arrivage ?
 * Détecte le mauvais fichier attaché au mauvais arrivage — une packing juste
 * mais posée au mauvais endroit reste une erreur d'inventaire.
 *
 * On cherche une PRÉSENCE, jamais une égalité : un titre s'écrit « CONTENEUR
 * GR 153 », « PACKING LIST GR153 », « GR-153 (DXB) ». L'inclusion se tente
 * d'abord sur la référence entière, puis sur sa seule suite de chiffres — c'est
 * ce qui laisse passer un préfixe orthographié autrement.
 *
 * Les deux références de l'arrivage n'ont pas le même poids, et c'est ce qui
 * évite de crier au loup :
 *
 *  · le n° INTERNE est celui que le fournisseur écrit — son absence du titre
 *    est un vrai signal, donc il peut répondre `false` ;
 *  · le n° ISO (`CSLU6080095`) n'apparaît quasiment jamais sur une packing
 *    list. Il peut CONFIRMER (`true`) mais jamais contredire : sans n° interne
 *    saisi, un titre qui ne le mentionne pas ne prouve rien, et la réponse est
 *    `null`. Avant cette distinction, tout arrivage renseigné avec son numéro
 *    ISO — c'est-à-dire tous — affichait l'alerte « mauvais arrivage » en
 *    permanence, et l'alerte ne voulait donc plus rien dire.
 *
 * `null` quand la question n'a pas de réponse : pas de titre, aucune référence
 * exploitable, ou un titre sans le moindre chiffre (« PACKING LIST » seul ne
 * contredit rien).
 */
export function containerLabelMatches(
    containerLabel: string | null,
    refs: ContainerRefs,
): boolean | null {
    if (!containerLabel) return null

    const haystack = normalizeContainerRef(containerLabel)
    const labelRuns = digitRuns(haystack)

    const mentions = (ref: string | null): boolean | null => {
        if (!ref) return null
        const needle = normalizeContainerRef(ref)
        if (needle.length < 3) return null
        if (haystack.includes(needle)) return true
        const needleRuns = digitRuns(needle)
        if (needleRuns.length === 0 || labelRuns.length === 0) return null
        return needleRuns.some((run) => labelRuns.includes(run))
    }

    const internal = mentions(refs.internalRef)
    if (internal !== null) return internal

    // Le n° ISO ne sait que confirmer.
    return mentions(refs.containerNo) === true ? true : null
}

export { PACKING_NORMALIZER_VERSION }
