import { expect, test } from "@rstest/core"
import { categoriesHabituelles, chercherCategories, derniereCommande } from "@/features/commandes/utils/commandeSuggestions"
import type { AvancementLigne, CommandeBoutique } from "@/features/commandes/types/commande.types"

const ligne = (commande_id: string, category_id: string, category_nom: string, kg_demande: number) =>
    ({ commande_id, category_id, category_nom, kg_demande }) as AvancementLigne
const commande = (id: string, code: string) => ({ id, code }) as CommandeBoutique

const HISTO = [
    ligne("c3", "jean", "Jeans", 48), ligne("c3", "pull", "Pulls", 25),
    ligne("c2", "jean", "Jeans", 52),
    ligne("c1", "jean", "Jeans", 50), ligne("c1", "robe", "Robes", 12), ligne("c1", "pull", "Pulls", 30),
]

test("habituelles : la plus fréquente d'abord, quantité ordinaire arrondie à 5 kg", () => {
    expect(categoriesHabituelles(HISTO)).toEqual([
        { category_id: "jean", nom: "Jeans", fois: 3, kgHabituel: 50 },
        { category_id: "pull", nom: "Pulls", fois: 2, kgHabituel: 30 },
        { category_id: "robe", nom: "Robes", fois: 1, kgHabituel: 10 },
    ])
    expect(categoriesHabituelles(HISTO, 1)).toHaveLength(1)
})

test("dernière commande : la plus récente, sauf celle qu'on modifie", () => {
    const commandes = [commande("c3", "CMD-0003"), commande("c2", "CMD-0002"), commande("c1", "CMD-0001")]
    expect(derniereCommande(commandes, HISTO)?.commande.code).toBe("CMD-0003")
    expect(derniereCommande(commandes, HISTO, "c3")).toEqual({
        commande: commandes[1],
        lignes: [{ category_id: "jean", kg: 52 }],
    })
    expect(derniereCommande([], HISTO)).toBeNull()
})

test("recherche : sans accents, « commence par » d'abord, sans les catégories prises", () => {
    const cats = [
        { id: "1", name: "Chemises" }, { id: "2", name: "Écharpes" }, { id: "3", name: "Jeans" }, { id: "4", name: "Vestes en jean" },
    ]
    expect(chercherCategories(cats, "echa", new Set()).map((c) => c.name)).toEqual(["Écharpes"])
    expect(chercherCategories(cats, "jea", new Set()).map((c) => c.name)).toEqual(["Jeans", "Vestes en jean"])
    expect(chercherCategories(cats, "jea", new Set(["3"])).map((c) => c.name)).toEqual(["Vestes en jean"])
    expect(chercherCategories(cats, "  ", new Set())).toEqual([])
})
