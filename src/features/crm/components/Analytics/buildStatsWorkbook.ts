import XLSX from "xlsx-js-style"
import type { StatRow } from "../../context/AnalyticsContext"
import { TARGET_IDS } from "./Widget/EventsPalier"

const round1 = (n: number) => Math.round(n * 10) / 10

// Modèle de colonne :
// - `get`     : valeur de la cellule (sauf colonne d'évolution CA, cf. caEvol).
// - `delta`   : la colonne est suivie d'une colonne Δ (tendance vs N-1).
// - `sales`   : colonne du bloc « ventes » (grisée pour les collaborateurs
//               situés au-dessus de la barre noire de séparation).
// - `caEvol`  : colonne unique « Variable d'évolution » = évolution du CA (%).
// - `width`   : largeur de la colonne (caractères Excel).
interface ColDef {
    header: string
    get?: (r: StatRow) => string | number
    delta?: boolean
    sales?: boolean
    caEvol?: boolean
    width: number
}

// Indices logiques utilisés par les formules (cf. ordre du tableau ci-dessous).
const L_ACTIVITE = 1
const L_APPEL = 3
const L_RDV = 5
const L_TAUX_APPEL = 6
const L_TAUX_ACTIVITE = 7
const L_PROFORMA = 8
const L_CA = 9
const L_PANIER = 10

const COLUMNS: ColDef[] = [
    { header: "Collaborateur", get: (r) => r.name, width: 24 },
    { header: "Activité total", get: (r) => r.activiteTotal, delta: true, width: 16 },
    { header: "Nbr message", get: (r) => r.nbMessage, delta: true, width: 16 },
    { header: "Nbr d'appel", get: (r) => r.nbAppel, delta: true, width: 16 },
    { header: "Nbr mail", get: (r) => r.nbMail, delta: true, width: 16 },
    { header: "Nbr de RDV pris", get: (r) => r.rdv, delta: true, width: 16 },
    {
        header: "Taux conv. appel (%)",
        get: (r) => (r.nbAppel ? round1((r.rdv / r.nbAppel) * 100) : 0),
        delta: true,
        width: 16,
    },
    {
        header: "Taux conv. activité totale (%)",
        get: (r) =>
            r.activiteTotal ? round1((r.rdv / r.activiteTotal) * 100) : 0,
        delta: true,
        width: 16,
    },
    // --- Bloc ventes (grisé au-dessus de la barre noire) ---
    { header: "Nbr bons proforma", get: (r) => r.nbProforma, sales: true, width: 16 },
    { header: "CA (€)", get: (r) => Math.round(r.ca), sales: true, width: 16 },
    {
        header: "Panier moyen (€)",
        get: (r) => (r.nbProforma ? round1(r.ca / r.nbProforma) : 0),
        sales: true,
        width: 16,
    },
    { header: "Variable d'évolution", caEvol: true, sales: true, width: 14 },
]

const HEADER_STYLE = {
    font: { bold: true, color: { rgb: "FFFFFF" }, sz: 10 },
    fill: { fgColor: { rgb: "111827" } },
    alignment: { horizontal: "center", vertical: "center" },
}
const TOTAL_STYLE = {
    font: { bold: true, sz: 10, color: { rgb: "111827" } },
    fill: { fgColor: { rgb: "D1D5DB" } },
}
// Grisage des colonnes ventes pour les collaborateurs au-dessus de la barre noire.
const GREY_SALES_STYLE = {
    fill: { fgColor: { rgb: "F3F4F6" } },
    font: { italic: true, color: { rgb: "9CA3AF" }, sz: 10 },
    alignment: { horizontal: "center" },
}

// Couleurs des barres de séparation entre groupes.
const SEP_COLORS = { black: "111827", red: "DC2626" } as const

function styleRow(
    ws: XLSX.WorkSheet,
    r: number,
    nbCols: number,
    style: object
) {
    for (let c = 0; c < nbCols; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })]
        if (cell) cell.s = style
    }
}

type SheetEntry =
    | { type: "row"; cur: StatRow; prev: StatRow }
    | { type: "sep"; color: string }

interface AppendSheetInput {
    wb: XLSX.WorkBook
    sheetName: string
    periodValueLabel: string
    ordered: SheetEntry[]
    // Désactive les colonnes Δ / styles de tendance : utilisé pour la
    // feuille « période précédente », qui n'a pas de N-2 pour se comparer.
    hasPrev: boolean
    layout: { def: ColDef; valueCol: number; deltaCol?: number }[]
    nbCols: number
    header: string[]
}

/**
 * Construit une feuille du classeur (en-tête, tableau, formules, mise en
 * forme) à partir d'une séquence de lignes déjà ordonnée (barres de
 * séparation comprises). Factorisé pour être appelé une fois par période
 * affichée (courante avec Δ, précédente sans Δ).
 */
function appendSheet({
    wb,
    sheetName,
    periodValueLabel,
    ordered,
    hasPrev,
    layout,
    nbCols,
    header,
}: AppendSheetInput) {
    const colOf = (i: number) => layout[i].valueCol

    // Styles des cellules de tendance (vs période précédente).
    const TREND = {
        up: {
            fill: { fgColor: { rgb: "C6EFCE" } },
            font: { bold: true, color: { rgb: "137333" } },
            alignment: { horizontal: "center" },
        },
        down: {
            fill: { fgColor: { rgb: "FFC7CE" } },
            font: { bold: true, color: { rgb: "A50E0E" } },
            alignment: { horizontal: "center" },
        },
        eq: {
            fill: { fgColor: { rgb: "D9D9D9" } },
            font: { bold: true, color: { rgb: "5F6368" } },
            alignment: { horizontal: "center" },
        },
    }
    const styled: { r: number; c: number; style: object }[] = []

    // Tendance vs période précédente : flèche + label (%), avec le style.
    // `null` => aucune tendance affichable (pas de N-1 ou valeurs non num.).
    const trendOf = (
        curN: number,
        prevN: number
    ): { text: string; style: object | null } => {
        if (!hasPrev || Number.isNaN(curN) || Number.isNaN(prevN))
            return { text: "", style: null }
        const up = curN > prevN
        const down = curN < prevN
        const arrow = up ? "▲" : down ? "▼" : "="
        let label: string
        if (curN === prevN) label = "0%"
        else if (prevN === 0) label = "nouv."
        else {
            const pct = round1(((curN - prevN) / prevN) * 100)
            label = `${pct > 0 ? "+" : ""}${pct}%`
        }
        return {
            text: `${arrow} ${label}`,
            style: up ? TREND.up : down ? TREND.down : TREND.eq,
        }
    }

    const aoa: (string | number)[][] = [
        ["Statistiques CRM"],
        ["Période", periodValueLabel],
        [],
        header, // index 3
    ]

    // Pousse une ligne valeur + tendance par colonne. `greySales` grise les
    // colonnes du bloc ventes (collaborateurs au-dessus de la barre noire).
    const pushRow = (
        cur: StatRow,
        prev: StatRow,
        opts?: { greySales?: boolean }
    ) => {
        const r = aoa.length
        const cells: (string | number)[] = []
        layout.forEach(({ def }) => {
            if (def.caEvol) {
                // Colonne d'évolution unique = évolution du CA.
                const { text, style } = trendOf(cur.ca, prev.ca)
                cells.push(text)
                if (!opts?.greySales && style)
                    styled.push({ r, c: cells.length - 1, style })
                return
            }
            const v = def.get!(cur)
            cells.push(v)
            if (def.delta) {
                const { text, style } = trendOf(
                    Number(v),
                    Number(def.get!(prev))
                )
                cells.push(text)
                if (style) styled.push({ r, c: cells.length - 1, style })
            }
        })
        // Grisage des colonnes ventes (appliqué après → prime sur le reste).
        if (opts?.greySales) {
            layout.forEach(({ def, valueCol }) => {
                if (def.sales)
                    styled.push({ r, c: valueCol, style: GREY_SALES_STYLE })
            })
        }
        aoa.push(cells)
    }

    const displayedRows = ordered
        .filter((e): e is { type: "row"; cur: StatRow; prev: StatRow } =>
            e.type === "row"
        )
        .map((e) => e.cur)
    const displayedPrev = ordered
        .filter((e): e is { type: "row"; cur: StatRow; prev: StatRow } =>
            e.type === "row"
        )
        .map((e) => e.prev)

    // Somme locale d'un sous-ensemble de lignes : le TOTAL ne doit refléter
    // QUE les collaborateurs affichés (sélectionnés), pas tous ceux ayant
    // des données. Évite l'écart « total ≠ addition des personnes ».
    const sumRows = (rows: StatRow[]): StatRow =>
        rows.reduce(
            (acc, r) => ({
                userId: "TOTAL",
                name: "TOTAL",
                activiteTotal: acc.activiteTotal + r.activiteTotal,
                nbMessage: acc.nbMessage + r.nbMessage,
                nbAppel: acc.nbAppel + r.nbAppel,
                nbMail: acc.nbMail + r.nbMail,
                nbQualification: acc.nbQualification + r.nbQualification,
                rdv: acc.rdv + r.rdv,
                nbProforma: acc.nbProforma + r.nbProforma,
                ca: acc.ca + r.ca,
            }),
            {
                userId: "TOTAL",
                name: "TOTAL",
                activiteTotal: 0,
                nbMessage: 0,
                nbAppel: 0,
                nbMail: 0,
                nbQualification: 0,
                rdv: 0,
                nbProforma: 0,
                ca: 0,
            }
        )

    // TOTAL = somme des SEULES lignes affichées (calculé en JS pour la
    // tendance ; les cellules chiffrées seront des formules SUM dans le
    // tableau, cf. plus bas).
    const totalRowIdx = aoa.length // index 4
    pushRow(sumRows(displayedRows), sumRows(displayedPrev))

    // Les collaborateurs situés AVANT la première barre noire forment le
    // bloc « hors ventes » : leurs colonnes ventes sont grisées.
    const firstBlackIdx = ordered.findIndex(
        (e) => e.type === "sep" && e.color === SEP_COLORS.black
    )

    const sepRows: { r: number; color: string }[] = []
    const dataRowIdxs: number[] = []
    ordered.forEach((e, idx) => {
        if (e.type === "sep") {
            aoa.push(Array.from({ length: nbCols }, () => ""))
            sepRows.push({ r: aoa.length - 1, color: e.color })
        } else {
            dataRowIdxs.push(aoa.length)
            pushRow(e.cur, e.prev, {
                greySales: firstBlackIdx !== -1 && idx < firstBlackIdx,
            })
        }
    })

    const ws = XLSX.utils.aoa_to_sheet(aoa)
    // Largeurs : largeur propre par colonne, colonnes Δ étroites (11).
    const cols: { wch: number }[] = []
    layout.forEach(({ def }) => {
        cols.push({ wch: def.width })
        if (def.delta) cols.push({ wch: 11 })
    })
    ws["!cols"] = cols
    if (ws["A1"]) ws["A1"].s = { font: { bold: true, sz: 13 } }
    styleRow(ws, 3, nbCols, HEADER_STYLE) // en-tête tableau
    styleRow(ws, totalRowIdx, nbCols, TOTAL_STYLE) // ligne TOTAL

    const rowsMeta: { hpt: number }[] = []
    sepRows.forEach(({ r, color }) => {
        styleRow(ws, r, nbCols, { fill: { fgColor: { rgb: color } } })
        rowsMeta[r] = { hpt: 6 }
    })
    ws["!rows"] = rowsMeta

    // Styles de tendance / grisage appliqués APRÈS (priment sur la ligne).
    styled.forEach(({ r, c, style }) => {
        const cell = ws[XLSX.utils.encode_cell({ r, c })]
        if (cell) cell.s = style
    })

    // --- CALCULS DANS LE TABLEAU (formules Excel) ---
    const setFormula = (r0: number, c0: number, f: string) => {
        const addr = XLSX.utils.encode_cell({ r: r0, c: c0 })
        const prev = ws[addr]
        ws[addr] = { t: "n", f, s: prev?.s, z: prev?.z }
    }
    // Taux de conversion + panier moyen calculés EN FEUILLE pour la ligne r0.
    const applyComputed = (r0: number) => {
        const R = r0 + 1
        const B = XLSX.utils.encode_col(colOf(L_ACTIVITE))
        const F = XLSX.utils.encode_col(colOf(L_APPEL))
        const L = XLSX.utils.encode_col(colOf(L_RDV))
        const P = XLSX.utils.encode_col(colOf(L_PROFORMA))
        const CA = XLSX.utils.encode_col(colOf(L_CA))
        // Taux conv. appel = RDV / appels
        setFormula(
            r0,
            colOf(L_TAUX_APPEL),
            `IF(${F}${R}=0,0,ROUND(${L}${R}/${F}${R}*100,1))`
        )
        // Taux conv. activité totale = RDV / activité totale
        setFormula(
            r0,
            colOf(L_TAUX_ACTIVITE),
            `IF(${B}${R}=0,0,ROUND(${L}${R}/${B}${R}*100,1))`
        )
        // Panier moyen = CA / nombre de bons proforma
        setFormula(
            r0,
            colOf(L_PANIER),
            `IF(${P}${R}=0,0,ROUND(${CA}${R}/${P}${R},1))`
        )
    }
    // Ligne TOTAL : colonnes additionnables = SUM des lignes affichées ;
    // les taux et le panier moyen sont recalculés à partir de ces totaux.
    if (dataRowIdxs.length > 0) {
        const first = Math.min(...dataRowIdxs) + 1
        const last = Math.max(...dataRowIdxs) + 1
        const summable = [
            L_ACTIVITE,
            2, // message
            L_APPEL,
            4, // mail
            L_RDV,
            L_PROFORMA,
            L_CA,
        ]
        summable.forEach((i) => {
            const c = colOf(i)
            const col = XLSX.utils.encode_col(c)
            setFormula(totalRowIdx, c, `SUM(${col}${first}:${col}${last})`)
        })
    }
    applyComputed(totalRowIdx)
    dataRowIdxs.forEach((r0) => applyComputed(r0))

    // Formats de nombre (TOTAL + lignes data). On force explicitement un
    // format pour CHAQUE colonne chiffrée afin qu'aucune cellule n'hérite
    // d'un format monétaire : le « € » ne doit apparaître QUE sur CA et
    // Panier moyen ; tout le reste (activité, messages, appels, mails, RDV,
    // taux, nb proforma) reste un nombre simple.
    const moneyRows = [totalRowIdx, ...dataRowIdxs]
    const setFmt = (logical: number, z: string) => {
        moneyRows.forEach((r0) => {
            const cell = ws[XLSX.utils.encode_cell({ r: r0, c: colOf(logical) })]
            if (cell) cell.z = z
        })
    }
    // Colonnes de comptage → entiers (jamais de €).
    ;[L_ACTIVITE, 2, L_APPEL, 4, L_RDV, L_PROFORMA].forEach((i) =>
        setFmt(i, "#,##0")
    )
    // Colonnes de taux → 1 décimale (jamais de €).
    ;[L_TAUX_APPEL, L_TAUX_ACTIVITE].forEach((i) => setFmt(i, "0.0"))
    // Colonnes monétaires → format € (les SEULES).
    setFmt(L_CA, '#,##0 "€"')
    setFmt(L_PANIER, '#,##0.0 "€"')

    // Unité pourcentage sur les colonnes de taux de conversion. Les valeurs
    // sont DÉJÀ ×100 (cf. formules ROUND(...*100,1)), donc on utilise un
    // suffixe littéral « % » entre guillemets pour ne pas laisser Excel
    // re-multiplier par 100 (ce que ferait le format natif "0.0%").
    const setPercentFmt = (logical: number) => {
        moneyRows.forEach((r0) => {
            const cell = ws[XLSX.utils.encode_cell({ r: r0, c: colOf(logical) })]
            if (cell) cell.z = '0.0"%"'
        })
    }
    setPercentFmt(L_TAUX_APPEL)
    setPercentFmt(L_TAUX_ACTIVITE)

    // « Nbr bons proforma » = simple compteur : format entier SANS unité
    // (ni %, ni €). Forcé explicitement pour écraser tout format hérité.
    setFmt(L_PROFORMA, "0")

    ws["!freeze"] = { xSplit: 0, ySplit: totalRowIdx }
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
}

export interface BuildStatsWorkbookInput {
    getStatsExportData: () => {
        perCollaborator: StatRow[]
        perCollaboratorPrev: StatRow[]
        hasPrev: boolean
        mode: "collaborators" | "daily"
    }
    selectedPeriod: string
    selectedFilter: string | null
    selectedCommercial: string
    crmUsers: { id: string; name: string }[]
    exportGroups: { ids: string[]; sepAfter?: "black" | "red" }[]
    exportFallbackNames: Record<string, string>
}

/**
 * Construit le classeur Excel des stats CRM (global + par collaborateur).
 * Extrait de ExportStatsButton.tsx pour être réutilisable par un canal
 * d'envoi (ex. newsletter de test) sans dupliquer la mise en forme.
 *
 * Copie côté serveur : supabase/functions/crm-stats-newsletter/workbook.ts
 * (digest cron) — y reporter toute modification.
 */
export function buildStatsWorkbook({
    getStatsExportData,
    selectedPeriod,
    selectedFilter,
    selectedCommercial,
    crmUsers,
    exportGroups,
    exportFallbackNames,
}: BuildStatsWorkbookInput): { wb: XLSX.WorkBook; filename: string } {
    const { perCollaborator, perCollaboratorPrev, hasPrev, mode } =
        getStatsExportData()
    // Mode « un seul collaborateur » : lignes = jours (pas de barres).
    const daily = mode === "daily"
    const wb = XLSX.utils.book_new()

    const byId = new Map(perCollaborator.map((r) => [r.userId, r]))
    const prevById = new Map(perCollaboratorPrev.map((r) => [r.userId, r]))
    // Libellé affiché : on privilégie le nom agrégé (= le setter réel du
    // RDV, champ `customer`) plutôt que le nom du compte central résolu via
    // `crmUsers`. On retombe sur le central / fallback uniquement si la
    // ligne n'a pas de données.
    const nameOf = (id: string) =>
        byId.get(id)?.name ||
        crmUsers.find((u) => u.id === id)?.name ||
        exportFallbackNames[id] ||
        id
    // Pour les comptes épinglés (centraux / paliers RDV) : on veut le libellé
    // canonique du compte (nom de repli DB « Nokk_project (central X) » ou nom de
    // profil), PAS le setter du RDV — sinon un compte central s'affiche sous
    // le nom d'un commercial. Priorité inverse de nameOf().
    const nameOfPinned = (id: string) =>
        exportFallbackNames[id] ||
        crmUsers.find((u) => u.id === id)?.name ||
        byId.get(id)?.name ||
        id
    const zero = (id: string, name = nameOf(id)): StatRow => ({
        userId: id,
        name,
        activiteTotal: 0,
        nbMessage: 0,
        nbAppel: 0,
        nbMail: 0,
        nbQualification: 0,
        rdv: 0,
        nbProforma: 0,
        ca: 0,
    })
    const rowFor = (id: string, name = nameOf(id)): StatRow => {
        const b = byId.get(id)
        return b ? { ...b, name } : zero(id, name)
    }
    const prevRowFor = (id: string): StatRow => prevById.get(id) ?? zero(id)

    // Disposition feuille : on déroule COLUMNS en colonnes Excel concrètes,
    // chaque colonne `delta` ajoutant une colonne Δ juste après.
    const layout: { def: ColDef; valueCol: number; deltaCol?: number }[] = []
    let nbCols = 0
    COLUMNS.forEach((def) => {
        const valueCol = nbCols++
        const entry: { def: ColDef; valueCol: number; deltaCol?: number } = {
            def,
            valueCol,
        }
        if (def.delta) entry.deltaCol = nbCols++
        layout.push(entry)
    })

    // En-tête : chaque colonne `delta` est suivie d'une colonne « Δ ».
    const header: string[] = []
    layout.forEach(({ def }) => {
        header.push(def.header)
        if (def.delta) header.push("Δ")
    })
    // En mode journalier, la 1re colonne liste les jours, pas les personnes.
    if (daily) header[0] = "Jour"

    // Construit la séquence ORDONNÉE des collaborateurs affichés (= ceux
    // sélectionnés via analytics_export_collaborators), avec les barres de
    // séparation. Mode strict : on n'affiche QUE les configurés ; on ne
    // retombe sur « tous ceux ayant des données » que si la config est vide
    // (pour ne jamais produire un export blanc).
    const ordered: SheetEntry[] = []
    const addRow = (id: string, name = nameOf(id)) => {
        ordered.push({ type: "row", cur: rowFor(id, name), prev: prevRowFor(id) })
    }
    if (daily) {
        // Un seul collaborateur : une ligne par jour, dans l'ordre
        // chronologique fourni par le contexte, sans barre de séparation.
        perCollaborator.forEach((cur) => {
            const prev = prevById.get(cur.userId) ?? zero(cur.userId, "")
            ordered.push({ type: "row", cur, prev })
        })
    } else {
        // Bloc cible épinglé en haut (comptes centraux / paliers RDV), quel
        // que soit l'ordre configuré en base.
        const pinnedIds = Array.from(TARGET_IDS)
        pinnedIds.forEach((id) => addRow(id, nameOfPinned(id)))

        if (exportGroups.length > 0) {
            exportGroups.forEach((g) => {
                const before = ordered.length
                g.ids.forEach((id) => {
                    if (!TARGET_IDS.has(id)) addRow(id) // dé-dup des cibles
                })
                // Séparateur seulement si le groupe a produit au moins une
                // ligne (évite un séparateur orphelin quand un groupe ne
                // contenait que des cibles déjà épinglées).
                if (g.sepAfter && ordered.length > before)
                    ordered.push({
                        type: "sep",
                        color: SEP_COLORS[g.sepAfter],
                    })
            })
        } else {
            // Fallback (config vide) : tous les collaborateurs ayant des
            // données, en excluant les cibles déjà épinglées.
            const seen = new Set(pinnedIds)
            perCollaborator.forEach((r) => {
                if (!r.userId || seen.has(r.userId)) return
                seen.add(r.userId)
                addRow(r.userId)
            })
        }
    }

    const periodLabel = `${selectedPeriod}${selectedFilter ? ` — ${selectedFilter}` : " — toutes données"}`
    appendSheet({
        wb,
        sheetName: "Statistiques CRM",
        periodValueLabel: periodLabel,
        ordered,
        hasPrev,
        layout,
        nbCols,
        header,
    })

    const today = new Date().toISOString().slice(0, 10)
    const tag = selectedFilter || selectedPeriod
    // En mode journalier, on préfixe par le nom du collaborateur ciblé.
    const who = daily
        ? (crmUsers.find((u) => u.id === selectedCommercial)?.name || "")
              .replace(/\s+/g, "_")
        : ""
    const filename = `stats_crm_${who ? `${who}_` : ""}${tag}_${today}.xlsx`

    return { wb, filename }
}
