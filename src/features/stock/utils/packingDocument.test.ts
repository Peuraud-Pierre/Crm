import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "@rstest/core"
import XLSX from "xlsx-js-style"
import {
    containerLabelMatches,
    fromWorksheet,
    normalizeContainerRef,
    PackingParseError,
    parsePackingDocument,
    type PackingDocument,
    type PackingDocumentLine,
    type RawWorksheet,
} from "./packingDocument"
import { normalizePackingLabel } from "./packingGrouping"

/**
 * Corpus doré du parsing de packing list : les deux vraies packings du
 * fournisseur, CONTENEUR GR153 et GR154.
 *
 * Ces attentes ne sont pas des choix d'implémentation, ce sont les FAITS des
 * deux fichiers, relevés à la main. Le service Go devra les reproduire à
 * l'identique : c'est ce fichier qui arbitre, pas le code TypeScript.
 *
 * Les deux documents diffèrent assez pour couvrir les pièges : nom de feuille
 * (« Invoice » / « Sheet1 »), plage déclarée trop large (GR154 va jusqu'à M),
 * cellules fusionnées, régime en kilos, et surtout un fichier qui se recoupe
 * (GR154 : 553 = 553) contre un qui ne se recoupe pas (GR153 : 543 ≠ 548).
 */

const FIXTURES = join(__dirname, "..", "__fixtures__", "packing")

function load(name: string): PackingDocument {
    const wb = XLSX.read(readFileSync(join(FIXTURES, name)), { type: "buffer" })
    const sheetName = wb.SheetNames[0]
    return parsePackingDocument(
        fromWorksheet(sheetName, wb.Sheets[sheetName] as unknown as RawWorksheet),
    )
}

/**
 * Poids réel d'un lot de lignes : le total du fichier quand il y est, et à
 * défaut le calcul du document. Même règle que `ligneTotal` côté synthèse.
 */
function effectiveWeight(lines: PackingDocumentLine[]): number {
    return lines.reduce(
        (sum, l) => sum + (l.declaredTotal ?? (l.unitsPerPackage ?? 0) * (l.packageCount ?? 0)),
        0,
    )
}

describe("parsePackingDocument — CONTENEUR GR153", () => {
    const doc = load("GR153.xlsx")

    it("lit la première feuille et retient son nom", () => {
        expect(doc.sheetName).toBe("Invoice")
    })

    it("lit le titre du conteneur au-dessus de l'en-tête", () => {
        expect(doc.containerLabel).toBe("CONTENEUR GR 153")
    })

    it("lit les 97 lignes de marchandise, ni l'en-tête ni le pied de page", () => {
        expect(doc.lines).toHaveLength(97)
        expect(doc.lines.map((l) => l.rawLabel)).not.toContain("ITEM #")
        expect(doc.lines.some((l) => /^TOTAL/i.test(l.rawLabel))).toBe(false)
    })

    it("reporte le libellé des cellules fusionnées sur les lignes de continuation", () => {
        // L'article 3 « POLO MEN SHIRT » s'étale sur les lignes Excel 6 et 7 :
        // 150 pcs × 3 colis, puis 200 pcs × 2 colis. Sans report, la ligne 7
        // perdrait son libellé.
        const continued = doc.lines.filter((l) => l.rawLabel === "POLO MEN SHIRT")
        expect(continued).toHaveLength(2)
        expect(continued.map((l) => l.sourceRow)).toEqual([6, 7])
        expect(continued.map((l) => l.packageCount)).toEqual([3, 2])
        expect(continued.map((l) => l.unitsPerPackage)).toEqual([150, 200])

        // 7 articles fusionnés produisent 9 lignes de continuation ; aucune ne
        // doit rester sans libellé.
        expect(doc.lines.every((l) => l.rawLabel.trim() !== "")).toBe(true)
    })

    it("distingue les deux régimes d'unité", () => {
        const kgs = doc.lines.filter((l) => l.unitKind === "kgs")
        const pcs = doc.lines.filter((l) => l.unitKind === "pcs")
        expect(kgs).toHaveLength(4)
        expect(pcs).toHaveLength(93)

        // Ligne 17 : le littéral « KGS » est dans la colonne PCS, le nombre
        // dans la colonne KGS. 25 kg × 3 colis = 75 kg.
        const corset = doc.lines.find((l) => l.rawLabel === "LADIES CORSET")
        expect(corset).toMatchObject({
            sourceRow: 17,
            unitKind: "kgs",
            unitsPerPackage: 25,
            packageCount: 3,
            declaredTotal: 75,
        })
    })

    it("pèse 2 370 kg en régime kilos, dont 3 lignes que le fichier ne totalise pas", () => {
        // Le chiffre qui manquait : sommer la seule colonne TOTAL donnait 75 kg
        // — le total d'UNE ligne sur quatre. Les trois autres sont vides dans
        // le fichier et valent « contenu par colis × colis ».
        const kgs = doc.lines.filter((l) => l.unitKind === "kgs")
        expect(kgs.filter((l) => l.declaredTotal === null)).toHaveLength(3)
        expect(effectiveWeight(kgs)).toBe(2370)
    })

    it("lit la première ligne telle quelle", () => {
        expect(doc.lines[0]).toMatchObject({
            position: 0,
            sourceRow: 4,
            rawLabel: "POLO 3BUTTON T-SHIRT",
            unitKind: "pcs",
            unitsPerPackage: 200,
            packageCount: 20,
            declaredTotal: 4000,
        })
    })

    it("totalise 543 colis et retient les 548 annoncés par le fichier", () => {
        expect(doc.totalPackages).toBe(543)
        expect(doc.declaredPackageCount).toBe(548)
    })

    it("signale que le fichier ne se recoupe pas lui-même", () => {
        const gap = doc.anomalies.filter((a) => a.kind === "file_package_count")
        expect(gap).toHaveLength(1)
        expect(gap[0].message).toContain("543")
        expect(gap[0].message).toContain("548")
    })

    it("signale les 3 lignes dont le fichier omet le total", () => {
        const missing = doc.anomalies.filter((a) => a.kind === "row_total_missing")
        expect(missing.map((a) => a.sourceRow)).toEqual([27, 29, 78])
    })

    it("ne signale aucune erreur de calcul sur les lignes qui ont un total", () => {
        expect(doc.anomalies.filter((a) => a.kind === "row_math")).toHaveLength(0)
    })

    it("ignore la colonne « (*) » comme donnée métier mais la garde en traçabilité", () => {
        const starred = doc.lines.find((l) => l.sourceRow === 13)
        expect(Object.values(starred?.rawRow ?? {})).toContain("(*)")
    })

    it("conserve le numéro d'article en traçabilité seulement — il est dupliqué", () => {
        // GR153 numérote « 9 » deux articles différents (lignes 13 et 14).
        const nines = doc.lines.filter((l) => l.rawRow["ITEM #"] === 9)
        expect(nines.map((l) => l.rawLabel)).toEqual([
            "OFFICIAL LEATHER JACKET",
            "LA R/N T-SHIRT",
        ])
    })
})

describe("parsePackingDocument — CONTENEUR GR154", () => {
    const doc = load("GR154.xlsx")

    it("lit une feuille au nom différent", () => {
        expect(doc.sheetName).toBe("Sheet1")
        expect(doc.containerLabel).toBe("CONTENEUR GR154")
    })

    it("lit les 139 lignes malgré une plage déclarée jusqu'à la colonne M", () => {
        expect(doc.lines).toHaveLength(139)
    })

    it("compte 10 lignes en kilos, pour 2 630 kg", () => {
        const kgs = doc.lines.filter((l) => l.unitKind === "kgs")
        expect(kgs).toHaveLength(10)
        // 9 des 10 n'ont aucun total dans le fichier. La synthèse n'affichait
        // donc que les 200 kg de la seule ligne totalisée — celle-là même dont
        // le fichier se trompe (ligne 127 : 200 annoncés pour 45 × 1).
        expect(kgs.filter((l) => l.declaredTotal === null)).toHaveLength(9)
        // 2 630 et non 2 475 : le total déclaré fait foi, faux compris. L'écart
        // est signalé comme anomalie, il n'est pas corrigé en silence.
        expect(effectiveWeight(kgs)).toBe(2630)
    })

    it("se recoupe : 553 colis lus, 553 annoncés, aucun écart de fichier", () => {
        expect(doc.totalPackages).toBe(553)
        expect(doc.declaredPackageCount).toBe(553)
        expect(doc.anomalies.filter((a) => a.kind === "file_package_count")).toHaveLength(0)
        expect(doc.anomalies.filter((a) => a.kind === "footer_mismatch")).toHaveLength(0)
    })

    it("reporte le libellé du premier article, étalé sur trois lignes", () => {
        const first = doc.lines.filter((l) => l.rawLabel === "BRAND FLEECE JACKET")
        expect(first.map((l) => l.sourceRow)).toEqual([4, 5, 6])
        expect(first.map((l) => l.packageCount)).toEqual([56, 1, 1])
    })
})

describe("parsePackingDocument — refus", () => {
    it("refuse une feuille sans en-tête reconnaissable", () => {
        const ws: RawWorksheet = { "!ref": "A1:B2", A1: { v: "Bonjour" }, B2: { v: 3 } }
        expect(() => parsePackingDocument(fromWorksheet("Feuil1", ws))).toThrow(PackingParseError)
    })

    it("refuse un en-tête sans aucune ligne de marchandise", () => {
        const ws: RawWorksheet = {
            "!ref": "A1:C1",
            A1: { v: "ITEM #" },
            B1: { v: "DESCRIPTION" },
            C1: { v: "QTY" },
        }
        expect(() => parsePackingDocument(fromWorksheet("Feuil1", ws))).toThrow(
            /Aucune ligne de marchandise/,
        )
    })
})

describe("le dictionnaire tient sa promesse d'un conteneur au suivant", () => {
    /**
     * Le cœur de la feature : le premier conteneur coûte cher, le suivant
     * beaucoup moins. Ce test mesure le gain réel entre les deux vrais
     * fichiers — si une modification du normaliseur le fait baisser, c'est une
     * régression fonctionnelle, pas un détail de test.
     */
    const learned = new Set(load("GR153.xlsx").lines.map((l) => l.rawLabelKey))
    const next = load("GR154.xlsx").lines

    it("reconnaît 47 des groupes de GR154 après le seul GR153", () => {
        const groups = new Set(next.map((l) => l.rawLabelKey))
        const known = [...groups].filter((k) => learned.has(k))
        expect(groups.size).toBe(121)
        expect(known).toHaveLength(47)
    })

    it("résout 55 des 139 lignes de GR154 sans aucune décision humaine", () => {
        expect(next.filter((l) => learned.has(l.rawLabelKey))).toHaveLength(55)
    })

    it("rapproche les orthographes flottantes du même article", () => {
        // Relevés à la main entre les deux fichiers : mêmes articles, graphies
        // différentes. Ce sont eux que le normaliseur v2 fait converger.
        const pairs: ReadonlyArray<[string, string]> = [
            ["NF NAYLON JACKET", "NF NYLON JACKET"],
            ["POLO SWEATSHIRT", "POLO SWEAT SHIRT"],
            ["COLUMB JACKET", "COLUM JACKET"],
            ["HELLY HANSEN JACKET", "HELLY HENSEN JACKET"],
            ["POLO 3 BUTTON T-SHIRT", "POLO 3BUTTON T-SHIRT"],
            ["POLO R/N TSHIRT", "POLO R/N T-SHIRT"],
            ["POLO SHORT", "POLO SHORTS"],
            ["BRAND MIX T-SHIRT 45KG", "BRAND MIX T-SHIRT"],
            ["NBA SPORT (A) T-SHIRT (DXB)", "NBA SPORT T-SHIRT (A) (DXB)"],
        ]
        for (const [a, b] of pairs) {
            expect(normalizePackingLabel(a)).toBe(normalizePackingLabel(b))
        }
    })

    it("ne fusionne aucun des 88 libellés distincts de GR153", () => {
        const labels = [...new Set(load("GR153.xlsx").lines.map((l) => l.rawLabel))]
        expect(labels).toHaveLength(88)
        expect(new Set(labels.map(normalizePackingLabel)).size).toBe(88)
    })

    it("garde distincts des articles voisins mais différents", () => {
        // Le rapprochement flou les confondait à 0,70-0,84 de confiance.
        const distinct: ReadonlyArray<[string, string]> = [
            ["BRAND FEATHER JACKET", "NF FEATHER JACKET"],
            ["TOMMY DENIM JACKET", "LLW DENIM JACKET"],
            ["POLO COTTON PANTS", "LVS COTTON PANTS"],
            ["BROOK BROTHER SWEATER", "BROOK BROHER SHIRT"],
            ["PATA LADIES SWEATER", "LA SWEATER"],
        ]
        for (const [a, b] of distinct) {
            expect(normalizePackingLabel(a)).not.toBe(normalizePackingLabel(b))
        }
    })
})

describe("le normaliseur SQL et le normaliseur TypeScript s'accordent", () => {
    /**
     * `normalize_packing_label(text)` en base est l'arbitre du normaliseur ;
     * le front et le service Go doivent produire la MÊME clé. S'ils divergent,
     * rien ne casse visiblement : le tableau de correspondance cesse
     * simplement de reconnaître des libellés qu'il connaît, et la charge de
     * vérification remonte sans explication.
     *
     * Transcription littérale de la fonction SQL de
     * `20260917101000_stock_packing_label_dictionary.sql`. À modifier EN MÊME
     * TEMPS que la migration et que `normalizePackingLabel` — c'est
     * précisément l'oubli que ce test attrape.
     */
    const SQL_FROM = "àáâãäåçèéêëìíîïñòóôõöùúûüýÿ"
    const SQL_TO = "aaaaaaceeeeiiiinooooouuuuyy"
    // `\y` de Postgres est la limite de mot, équivalente à `\b` en JavaScript.
    const SQL_SYNONYMS: ReadonlyArray<[RegExp, string]> = [
        [/\btshirt\b/g, "t shirt"],
        [/\bsweatshirt\b/g, "sweat shirt"],
        [/\bjkt\b/g, "jacket"],
        [/\bnaylon\b/g, "nylon"],
        [/\bcolumb\b/g, "colum"],
        [/\bhensen\b/g, "hansen"],
        [/\bbrohers?\b/g, "brother"],
        [/\b3button\b/g, "3 button"],
        [/\bpolyster\b/g, "poly"],
        [/\breyon\b/g, "rayon"],
    ]
    const SQL_STOP = ["a", "dxb", "usa", "kg", "kgs"]

    function sqlNormalize(label: string): string {
        // lower() puis translate()
        let s = [...label.toLowerCase()]
            .map((ch) => {
                const i = SQL_FROM.indexOf(ch)
                return i === -1 ? ch : SQL_TO[i]
            })
            .join("")
        // regexp_replace(s, '[^a-z0-9]+', ' ', 'g')
        s = s.replace(/[^a-z0-9]+/g, " ")
        for (const [pattern, replacement] of SQL_SYNONYMS) s = s.replace(pattern, replacement)
        // btrim + string_to_array + le WHERE de la CTE tokens
        return s
            .trim()
            .split(" ")
            .filter((tok) => tok !== "" && !SQL_STOP.includes(tok) && !/^[0-9]+kg$/.test(tok))
            // La dépluralisation du string_agg
            .map((tok) => (tok.length > 1 && tok.endsWith("s") ? tok.slice(0, -1) : tok))
            .join(" ")
    }

    const everyRealLabel = [
        ...load("GR153.xlsx").lines.map((l) => l.rawLabel),
        ...load("GR154.xlsx").lines.map((l) => l.rawLabel),
    ]

    it("produit la même clé sur les 236 libellés des deux packings réelles", () => {
        expect(everyRealLabel).toHaveLength(236)
        const divergent = everyRealLabel.filter(
            (label) => sqlNormalize(label) !== normalizePackingLabel(label),
        )
        expect(divergent).toEqual([])
    })

    it("s'accorde aussi sur les cas tordus", () => {
        const awkward = [
            "  Pull-Ralph  Lauren (Été) ",
            "NBA SPORT (A) T-SHIRT (DXB)",
            "BRAND MIX T-SHIRT 45KG",
            "501 U.S.A. PANTS",
            "CHT JEANS PANT (A)",
            "",
            "   ",
            "(*)",
            "ÉTÉ 2026 — NOËL",
        ]
        for (const label of awkward) {
            expect(sqlNormalize(label)).toBe(normalizePackingLabel(label))
        }
    })
})

describe("containerLabelMatches", () => {
    /** Les deux références d'un arrivage, `containerNo` ISO par défaut. */
    const refs = (internalRef: string | null, containerNo: string | null = "CSLU6080095") => ({
        internalRef,
        containerNo,
    })

    it("cherche le n° interne dans le titre, sans exiger la même écriture", () => {
        expect(containerLabelMatches("CONTENEUR GR 153", refs("GR153"))).toBe(true)
        expect(containerLabelMatches("CONTENEUR GR154", refs("GR 154"))).toBe(true)
        expect(containerLabelMatches("PACKING LIST GR-153 (DXB)", refs("gr 153"))).toBe(true)
    })

    it("se rabat sur le seul numéro quand le préfixe est écrit autrement", () => {
        // Le fournisseur écrit « CONT. 153 » là où l'arrivage dit « GR 153 » :
        // le numéro est bien présent, c'est ce qu'on cherche.
        expect(containerLabelMatches("CONT. 153", refs("GR 153"))).toBe(true)
    })

    it("détecte un fichier attaché au mauvais arrivage", () => {
        expect(containerLabelMatches("CONTENEUR GR 153", refs("GR154"))).toBe(false)
    })

    it("le n° ISO confirme, mais ne contredit jamais", () => {
        // Il n'apparaît pratiquement jamais sur une packing list : son absence
        // ne prouve rien, et l'alerte se serait allumée sur tous les arrivages.
        expect(containerLabelMatches("CONTENEUR GR 153", refs(null))).toBeNull()
        expect(containerLabelMatches("CONTENEUR CSLU6080095", refs(null))).toBe(true)
    })

    it("ne se prononce pas quand la question n'a pas de réponse", () => {
        expect(containerLabelMatches(null, refs("GR153"))).toBeNull()
        expect(containerLabelMatches("CONTENEUR GR 153", refs(null, null))).toBeNull()
        // Trop court : une inclusion ne voudrait rien dire.
        expect(containerLabelMatches("CONTENEUR GR 153", refs("G"))).toBeNull()
        // Un titre sans le moindre chiffre ne contredit rien.
        expect(containerLabelMatches("PACKING LIST", refs("GR153"))).toBeNull()
    })

    it("normalise une référence de conteneur", () => {
        expect(normalizeContainerRef("gr-153 ")).toBe("GR153")
    })
})

describe("nombres écrits en texte", () => {
    /** Feuille minimale : en-tête, une ligne, tout en chaînes de caractères. */
    function textSheet(kgs: string, pcs: string, qty: string, total: string): PackingDocument {
        const cells: Record<string, string> = {
            A1: "ITEM #", B1: "DESCRIPTION", C1: "KGS", D1: "PCS", E1: "QTY", F1: "TOTAL PCS/KG",
            A2: "1", B2: "POLO T-SHIRT", C2: kgs, D2: pcs, E2: qty, F2: total,
        }
        return parsePackingDocument({
            name: "Sheet1",
            rowCount: 2,
            colCount: 6,
            merges: [],
            cell: (row, col) => cells[`${String.fromCharCode(65 + col)}${row + 1}`] ?? null,
        })
    }

    it("lit un nombre stocké en texte plutôt que de perdre la ligne", () => {
        // Une colonne saisie à la main ou collée depuis un PDF arrive en texte.
        // Avant, la ligne partait sans colis, sans contenu et sans total.
        const [line] = textSheet("", "200", "20", "4 000").lines
        expect(line).toMatchObject({ unitKind: "pcs", unitsPerPackage: 200, packageCount: 20 })
        expect(line.declaredTotal).toBe(4000)
    })

    it("tranche entre séparateur de milliers et décimale", () => {
        expect(textSheet("", "1,200", "1", "1,200").lines[0].unitsPerPackage).toBe(1200)
        expect(textSheet("45,5", "", "1", "45,5").lines[0].unitsPerPackage).toBe(45.5)
        expect(textSheet("", "1,234.5", "1", "1234.5").lines[0].unitsPerPackage).toBe(1234.5)
    })

    it("ne prend jamais un littéral pour un nombre", () => {
        // Piège n° 5 : « KGS » vit dans la colonne PCS, le nombre dans KGS.
        const [line] = textSheet("25", "KGS", "3", "75").lines
        expect(line).toMatchObject({ unitKind: "kgs", unitsPerPackage: 25, packageCount: 3 })
    })
})
