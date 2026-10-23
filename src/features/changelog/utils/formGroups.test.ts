import { expect, test } from "@rstest/core"
import type { ChangelogItemInput } from "../types/changelog.types"
import { groupsToItems, hasContent, itemsToGroups } from "./formGroups"

const items: ChangelogItemInput[] = [
    { category_id: "c1", title: "CRM", description: "corrige X", position: 0 },
    { category_id: "c1", title: "CRM", description: "corrige Y", position: 1 },
    { category_id: "c2", title: "Stock", description: "ajoute Z", position: 2 },
]

test("itemsToGroups ne retient que la catégorie demandée", () => {
    const groups = itemsToGroups(items, "c1")

    expect(groups).toHaveLength(1)
    expect(groups[0]).toEqual({
        categoryId: "c1",
        title: "CRM",
        descriptions: ["corrige X", "corrige Y"],
    })
})

test("l'aller-retour groupes ↔ éléments préserve le contenu", () => {
    const restored = groupsToItems(itemsToGroups(items, "c1"))

    expect(restored).toEqual([
        {
            category_id: "c1",
            title: "CRM",
            description: "corrige X",
            position: 0,
        },
        {
            category_id: "c1",
            title: "CRM",
            description: "corrige Y",
            position: 1,
        },
    ])
})

test("groupsToItems écarte les groupes sans titre", () => {
    // Un titre vide produirait des lignes anonymes, invisibles dans
    // l'affichage qui regroupe par titre.
    const result = groupsToItems([
        { categoryId: "c1", title: "  ", descriptions: ["orpheline"] },
        { categoryId: "c1", title: "CRM", descriptions: ["gardée"] },
    ])

    expect(result).toHaveLength(1)
    expect(result[0].description).toBe("gardée")
})

test("les positions sont renumérotées de façon continue", () => {
    const result = groupsToItems([
        { categoryId: "c1", title: "A", descriptions: ["1", "2"] },
        { categoryId: "c2", title: "B", descriptions: ["3"] },
    ])

    expect(result.map((i) => i.position)).toEqual([0, 1, 2])
})

test("hasContent détecte un titre seul comme du contenu", () => {
    expect(hasContent([])).toBe(false)
    expect(
        hasContent([{ categoryId: "c1", title: "", descriptions: [""] }])
    ).toBe(false)
    expect(
        hasContent([{ categoryId: "c1", title: "CRM", descriptions: [""] }])
    ).toBe(true)
    expect(
        hasContent([{ categoryId: "c1", title: "", descriptions: ["texte"] }])
    ).toBe(true)
})
