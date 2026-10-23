import { describe, expect, test } from "@rstest/core"
import type {
    PackingListLigne,
    PackingListSummary,
} from "@/features/stock/types/packing-list.types"
import {
    filterGroups,
    groupByCategory,
    groupLignes,
    normalizePackingLabel,
    packingFileIntegrity,
    packingGap,
    recentCategories,
    reviewProgress,
} from "./packingGrouping"

let seq = 0

function ligne(over: Partial<PackingListLigne> = {}): PackingListLigne {
    seq += 1
    const raw = over.raw_label ?? "PLO RalLrt"
    return {
        id: `l-${seq}`,
        packing_list_id: "p1",
        position: seq,
        source_row: seq + 3,
        raw_label: raw,
        raw_label_key: normalizePackingLabel(raw),
        raw_row: null,
        package_count: 10,
        units_per_package: 200,
        unit_kind: "pcs",
        declared_total: 2000,
        suggested_category_id: "pull",
        match_confidence: 0.8,
        suggestion_source: "model",
        category_id: "pull",
        resolution: "human",
        normalizer_version: 2,
        reviewed_at: "2026-09-17T00:00:00Z",
        reviewed_by: null,
        ...over,
    }
}

/** Une ligne encore à classer : ni catégorie retenue, ni arbitrage. */
function unmatched(over: Partial<PackingListLigne> = {}): PackingListLigne {
    return ligne({ category_id: null, resolution: null, reviewed_at: null, ...over })
}

function summary(over: Partial<PackingListSummary> = {}): PackingListSummary {
    return {
        id: "p1",
        arrivage_manuel_id: "a1",
        status: "a_verifier",
        source_filename: "pl.xlsx",
        error_message: null,
        imported_by: null,
        imported_at: "2026-09-15T00:00:00Z",
        validated_by: null,
        validated_at: null,
        created_at: "2026-09-15T00:00:00Z",
        updated_at: "2026-09-15T00:00:00Z",
        container_label: "CONTENEUR GR 153",
        source_sheet: "Invoice",
        declared_package_count: 100,
        line_count: 3,
        lines_unmatched: 0,
        lines_from_dictionary: 0,
        lines_from_model: 0,
        lines_reviewed: 3,
        total_packages: 100,
        total_pieces: 20000,
        total_weight_kg: 1000,
        rows_failing_math: 0,
        package_count_gap: 0,
        ...over,
    }
}

describe("normalizePackingLabel", () => {
    test("retire accents, casse et ponctuation", () => {
        expect(normalizePackingLabel("  Pull-Ralph  Lauren (Été) ")).toBe("pull ralph lauren ete")
    })

    test("harmonise les orthographes flottantes du fournisseur", () => {
        // Relevées entre CONTENEUR GR153 et GR154 : mêmes articles, graphies
        // différentes. Le corpus complet vit dans `packingDocument.test.ts`.
        expect(normalizePackingLabel("POLO R/N TSHIRT")).toBe(normalizePackingLabel("POLO R/N T-SHIRT"))
        expect(normalizePackingLabel("NF NAYLON JACKET")).toBe(normalizePackingLabel("NF NYLON JACKET"))
        expect(normalizePackingLabel("POLO SHORT")).toBe(normalizePackingLabel("POLO SHORTS"))
    })

    test("retire les jetons sans valeur discriminante", () => {
        expect(normalizePackingLabel("NBA SPORT (A) T-SHIRT (DXB)")).toBe("nba sport t shirt")
        expect(normalizePackingLabel("BRAND MIX T-SHIRT 45KG")).toBe("brand mix t shirt")
    })

    test("ne confond pas deux marques différentes", () => {
        expect(normalizePackingLabel("BRAND FEATHER JACKET")).not.toBe(
            normalizePackingLabel("NF FEATHER JACKET"),
        )
    })
})

describe("groupLignes", () => {
    test("regroupe par libellé normalisé et somme les totaux", () => {
        const groups = groupLignes([
            ligne({ raw_label: "PLO RalLrt", package_count: 40, declared_total: 8000 }),
            // Total absent du fichier : 200 pcs × 15 colis le rétablit.
            ligne({ raw_label: "plo rallrt", package_count: 15, declared_total: null }),
        ])

        expect(groups).toHaveLength(1)
        expect(groups[0].lignes).toHaveLength(2)
        expect(groups[0].totalPackages).toBe(55)
        expect(groups[0].totalPieces).toBe(11000)
    })

    test("une ligne sans total déclaré compte pour son contenu × ses colis", () => {
        // Le fournisseur laisse la colonne TOTAL vide sur 3 lignes en kilos
        // sur 4 dans GR153 : les compter pour zéro affichait 75 kg là où le
        // conteneur en porte 2 370.
        const [group] = groupLignes([
            ligne({ unit_kind: "kgs", units_per_package: 45, package_count: 47, declared_total: null }),
            ligne({ unit_kind: "kgs", units_per_package: 25, package_count: 3, declared_total: 75 }),
        ])

        expect(group.totalWeightKg).toBe(45 * 47 + 75)
    })

    test("le total déclaré fait foi même quand il ne tombe pas juste", () => {
        // Le document est la source ; l'écart est une ANOMALIE signalée sur la
        // ligne, pas quelque chose que la synthèse corrige en douce.
        const [group] = groupLignes([
            ligne({ unit_kind: "pcs", units_per_package: 200, package_count: 20, declared_total: 3990 }),
        ])

        expect(group.totalPieces).toBe(3990)
    })

    test("une ligne sans colis ni contenu ne se compte pas", () => {
        const [group] = groupLignes([
            ligne({ unit_kind: "pcs", units_per_package: null, package_count: null, declared_total: null }),
        ])

        expect(group.totalPieces).toBe(0)
    })

    test("ne mélange pas les pièces et les kilos dans un même total", () => {
        const [group] = groupLignes([
            ligne({ unit_kind: "pcs", declared_total: 4000 }),
            ligne({ unit_kind: "kgs", declared_total: 75 }),
        ])

        expect(group.totalPieces).toBe(4000)
        expect(group.totalWeightKg).toBe(75)
    })

    test("ordre de revue : à classer d'abord, acquis ensuite, reconnus en dernier", () => {
        const groups = groupLignes([
            ligne({ raw_label: "DEJA VU", resolution: "dictionary", reviewed_at: null }),
            ligne({ raw_label: "LEVIS 501" }),
            unmatched({ raw_label: "MIX JKT", suggested_category_id: null }),
        ])

        expect(groups.map((g) => g.rawLabel)).toEqual(["MIX JKT", "LEVIS 501", "DEJA VU"])
        expect(groups.map((g) => g.state)).toEqual(["unmatched", "reviewed", "dictionary"])
    })

    test("un groupe classé par le modèle passe juste après les groupes à classer", () => {
        const groups = groupLignes([
            ligne({ raw_label: "DEJA VU", resolution: "dictionary", reviewed_at: null }),
            ligne({ raw_label: "LEVIS 501" }),
            ligne({ raw_label: "POLO MEN SHIRT", resolution: "model", reviewed_at: null }),
            unmatched({ raw_label: "MIX JKT", suggested_category_id: null }),
        ])

        expect(groups.map((g) => g.state)).toEqual(["unmatched", "model", "reviewed", "dictionary"])
    })

    test("un humain qui corrige une ligne du modèle fait passer le groupe en vérifié", () => {
        const [group] = groupLignes([
            ligne({ resolution: "model", reviewed_at: null }),
            ligne({ resolution: "human" }),
        ])

        expect(group.state).toBe("reviewed")
    })

    test("à état égal, le plus gros lot de colis passe devant", () => {
        // Le poids ne peut pas départager : 93 lignes sur 97 de CONTENEUR GR153
        // n'en portent aucun. C'est le colis qui mesure le risque.
        const groups = groupLignes([
            unmatched({ raw_label: "PETIT LOT", package_count: 1 }),
            unmatched({ raw_label: "GROS LOT", package_count: 56 }),
        ])

        expect(groups.map((g) => g.rawLabel)).toEqual(["GROS LOT", "PETIT LOT"])
    })

    test("à colis égal, la proposition la moins sûre passe devant", () => {
        const groups = groupLignes([
            unmatched({ raw_label: "SURE", match_confidence: 0.9 }),
            unmatched({ raw_label: "DOUBTFUL", match_confidence: 0.3 }),
        ])

        expect(groups.map((g) => g.rawLabel)).toEqual(["DOUBTFUL", "SURE"])
    })

    test("un groupe n'est reconnu que si TOUTES ses lignes viennent du dictionnaire", () => {
        const [group] = groupLignes([
            ligne({ resolution: "dictionary" }),
            ligne({ resolution: "human" }),
        ])

        expect(group.state).toBe("reviewed")
    })

    test("un groupe aux catégories divergentes est mixte et n'a pas de catégorie commune", () => {
        const [group] = groupLignes([ligne({ category_id: "pull" }), ligne({ category_id: "polo" })])

        expect(group.mixed).toBe(true)
        expect(group.categoryId).toBeNull()
    })

    test("la confiance d'un groupe est celle de sa ligne la plus douteuse", () => {
        const [group] = groupLignes([ligne({ match_confidence: 0.9 }), ligne({ match_confidence: 0.4 })])

        expect(group.confidence).toBe(0.4)
    })

    test("les lignes sans colis comptent pour zéro, sans NaN", () => {
        const [group] = groupLignes([ligne({ package_count: null }), ligne({ package_count: 12 })])

        expect(group.totalPackages).toBe(12)
    })
})

describe("reviewProgress", () => {
    test("la validation est bloquée tant qu'une ligne n'a pas de catégorie", () => {
        const blocked = reviewProgress(groupLignes([ligne(), unmatched({ raw_label: "X" })]))
        expect(blocked.canValidate).toBe(false)
        expect(blocked.unmatchedLines).toBe(1)
        expect(blocked.unmatchedGroups).toBe(1)
    })

    test("une proposition non retenue ne débloque rien", () => {
        // C'est le verrou de rigueur : l'import ne retient une catégorie que
        // sur correspondance exacte du dictionnaire. Une simple suggestion
        // laisse `category_id` vide, donc la validation fermée.
        const suggested = reviewProgress(
            groupLignes([unmatched({ raw_label: "PROPOSÉ", suggested_category_id: "pull" })]),
        )
        expect(suggested.canValidate).toBe(false)
    })

    test("les libellés reconnus par le dictionnaire comptent comme acquis", () => {
        const progress = reviewProgress(
            groupLignes([
                ligne({ raw_label: "DEJA VU", resolution: "dictionary", reviewed_at: null }),
                ligne({ raw_label: "TRANCHÉ" }),
            ]),
        )

        expect(progress.dictionaryGroups).toBe(1)
        expect(progress.reviewedGroups).toBe(1)
        expect(progress.unmatchedGroups).toBe(0)
        expect(progress.canValidate).toBe(true)
    })

    test("une packing vide ne se valide pas", () => {
        expect(reviewProgress([]).canValidate).toBe(false)
    })
})

describe("groupByCategory", () => {
    test("range par catégorie retenue en gardant les libellés bruts", () => {
        const groups = groupByCategory([
            ligne({ raw_label: "PLO RalLrt", category_id: "polo", package_count: 5 }),
            ligne({ raw_label: "POLO RL", category_id: "polo", package_count: 5 }),
            ligne({ raw_label: "LEVIS", category_id: "jean", package_count: 30 }),
        ])

        expect(groups.map((g) => g.categoryId)).toEqual(["jean", "polo"])
        expect(groups[1].rawLabels).toEqual(["PLO RalLrt", "POLO RL"])
        expect(groups[1].totalPackages).toBe(10)
    })
})

describe("packingGap", () => {
    // La « Quantité » saisie sur un arrivage est un nombre de COLIS.
    const declared = { total_weight_kg: 1000, total_qty: 100 }

    test("pas de packing, ou packing vide : pas d'écart", () => {
        expect(packingGap(declared, null)).toBeNull()
        expect(packingGap(declared, summary({ line_count: 0 }))).toBeNull()
    })

    test("rien de saisi sur l'arrivage : pas d'écart", () => {
        expect(packingGap({ total_weight_kg: null, total_qty: null }, summary())).toBeNull()
    })

    test("un écart dans la tolérance n'est pas une divergence", () => {
        const gap = packingGap(declared, summary({ total_packages: 101, total_weight_kg: 1000 }))
        expect(gap).toEqual({ packages: 1, weightKg: 0, diverges: false })
    })

    test("au-delà de la tolérance, l'écart diverge", () => {
        const gap = packingGap(declared, summary({ total_packages: 103 }))
        expect(gap?.diverges).toBe(true)
    })

    test("les colis seuls suffisent à diverger", () => {
        const gap = packingGap(declared, summary({ total_packages: 80, total_weight_kg: 1000 }))
        expect(gap).toEqual({ packages: -20, weightKg: 0, diverges: true })
    })

    test("une packing sans poids ne crée pas un écart de poids", () => {
        // Le cas courant : 93 lignes sur 97 de CONTENEUR GR153 ne comptent
        // qu'en pièces. `total_weight_kg` vaut alors 0, et ce zéro veut dire
        // « non renseigné », pas « zéro kilo ».
        const gap = packingGap(declared, summary({ total_weight_kg: 0, total_packages: 100 }))
        expect(gap).toEqual({ packages: 0, weightKg: null, diverges: false })
    })

    test("déclaré à zéro : tout écart diverge", () => {
        const gap = packingGap(
            { total_weight_kg: null, total_qty: 0 },
            summary({ total_packages: 5 }),
        )
        expect(gap).toEqual({ packages: 5, weightKg: null, diverges: true })
    })
})

describe("packingFileIntegrity", () => {
    test("un fichier qui se recoupe est sain", () => {
        expect(packingFileIntegrity(summary({ package_count_gap: 0, rows_failing_math: 0 }))).toEqual({
            packageCountGap: 0,
            rowsFailingMath: 0,
            sound: true,
        })
    })

    test("un écart de colis rend le fichier douteux", () => {
        // Le cas réel de CONTENEUR GR153 : 543 colis sur les lignes, 548
        // annoncés en pied de page.
        const integrity = packingFileIntegrity(
            summary({ total_packages: 543, declared_package_count: 548, package_count_gap: -5 }),
        )
        expect(integrity).toEqual({ packageCountGap: -5, rowsFailingMath: 0, sound: false })
    })

    test("des lignes dont le calcul ne tombe pas juste rendent le fichier douteux", () => {
        const integrity = packingFileIntegrity(
            summary({ package_count_gap: 0, rows_failing_math: 3 }),
        )
        expect(integrity?.sound).toBe(false)
        expect(integrity?.rowsFailingMath).toBe(3)
    })

    test("rien à contrôler : pas de packing, ou un fichier qui n'annonce aucun total", () => {
        expect(packingFileIntegrity(null)).toBeNull()
        expect(packingFileIntegrity(summary({ line_count: 0 }))).toBeNull()
        // Sans total annoncé ni ligne fautive, il n'y a rien à confronter :
        // on ne peut pas déclarer le fichier sain, seulement incontrôlable.
        expect(
            packingFileIntegrity(
                summary({ declared_package_count: null, package_count_gap: null, rows_failing_math: 0 }),
            ),
        ).toBeNull()
    })
})

describe("catégories récemment utilisées", () => {
    test("les catégories reviennent de la plus récente à la plus ancienne, sans doublon", () => {
        const groups = groupLignes([
            ligne({ raw_label: "A", category_id: "pull", reviewed_at: "2026-09-17T10:00:00Z" }),
            ligne({ raw_label: "B", category_id: "jean", reviewed_at: "2026-09-17T12:00:00Z" }),
            ligne({ raw_label: "C", category_id: "pull", reviewed_at: "2026-09-17T14:00:00Z" }),
        ])

        // « pull » remonte en tête parce qu'il a servi en dernier, et n'est
        // compté qu'une fois.
        expect(recentCategories(groups)).toEqual(["pull", "jean"])
    })

    test("seules les décisions humaines comptent : ni dictionnaire, ni modèle", () => {
        // Une catégorie reprise du tableau ou devinée par le modèle ne dit rien
        // de ce que la personne est en train de faire.
        const groups = groupLignes([
            ligne({ raw_label: "A", category_id: "pull", resolution: "dictionary" }),
            ligne({ raw_label: "B", category_id: "jean", resolution: "model" }),
            ligne({ raw_label: "C", category_id: "polo", resolution: "human" }),
        ])

        expect(recentCategories(groups)).toEqual(["polo"])
    })

    test("la liste est plafonnée", () => {
        const groups = groupLignes(
            ["a", "b", "c", "d", "e", "f"].map((name, index) =>
                ligne({
                    raw_label: name.toUpperCase(),
                    category_id: name,
                    reviewed_at: `2026-09-17T1${index}:00:00Z`,
                }),
            ),
        )

        expect(recentCategories(groups)).toHaveLength(5)
        expect(recentCategories(groups, 2)).toEqual(["f", "e"])
    })

    test("aucune décision prise : aucune récente", () => {
        expect(recentCategories(groupLignes([unmatched()]))).toEqual([])
    })
})

describe("recherche et ordre de la strate", () => {
    const groups = () =>
        groupLignes([
            unmatched({ raw_label: "T-SHIRT POLO", package_count: 50 }),
            unmatched({ raw_label: "MEN JKT NYLON", package_count: 30 }),
            unmatched({ raw_label: "LADIES JACKET", package_count: 10 }),
        ])

    test("la recherche passe par le normaliseur : « tshirt » trouve « T-SHIRT »", () => {
        const found = filterGroups(groups(), { query: "tshirt", sort: "risque" })
        expect(found.map((g) => g.rawLabel)).toEqual(["T-SHIRT POLO"])
    })

    test("« jkt » et « jacket » désignent la même famille", () => {
        const found = filterGroups(groups(), { query: "jacket", sort: "risque" })
        expect(found.map((g) => g.rawLabel).sort()).toEqual(["LADIES JACKET", "MEN JKT NYLON"])
    })

    test("l'ordre par défaut reste celui du risque : les gros lots d'abord", () => {
        const order = filterGroups(groups(), { query: "", sort: "risque" }).map((g) => g.totalPackages)
        expect(order).toEqual([50, 30, 10])
    })

    test("le tri par libellé rapproche ce que l'œil doit comparer", () => {
        const order = filterGroups(groups(), { query: "", sort: "libelle" }).map((g) => g.rawLabel)
        expect(order).toEqual(["LADIES JACKET", "MEN JKT NYLON", "T-SHIRT POLO"])
    })

    test("le tri par libellé ne mélange pas les strates entre elles", () => {
        // L'ordre ENTRE états porte le sens de l'écran : à classer d'abord.
        const mixed = groupLignes([
            ligne({ raw_label: "AAA CLASSÉ" }),
            unmatched({ raw_label: "ZZZ À CLASSER" }),
        ])
        const order = filterGroups(mixed, { query: "", sort: "libelle" }).map((g) => g.state)
        expect(order).toEqual(["unmatched", "reviewed"])
    })

    test("une recherche qui ne survit pas à la normalisation reste utile", () => {
        // « a » est un jeton sans valeur discriminante, retiré par le
        // normaliseur : sans repli, le filtre serait inerte et silencieux.
        const found = filterGroups(groups(), { query: "a", sort: "risque" })
        expect(found.map((g) => g.rawLabel)).toEqual(["MEN JKT NYLON", "LADIES JACKET"])
    })
})
