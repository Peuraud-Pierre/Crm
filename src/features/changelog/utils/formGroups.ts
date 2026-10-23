import type { ChangelogItemInput } from "../types/changelog.types"

/**
 * Unité de saisie du formulaire : un titre et les lignes écrites dessous,
 * dans une catégorie.
 *
 * La base, elle, stocke une ligne par description (`changelog_items`).
 * Ces deux fonctions font l'aller-retour entre les deux formes.
 */
export interface TitleGroup {
    categoryId: string
    title: string
    descriptions: string[]
}

/** Éléments d'une catégorie → groupes de saisie, dans l'ordre d'apparition. */
export function itemsToGroups(
    items: ChangelogItemInput[],
    categoryId: string
): TitleGroup[] {
    const byTitle = new Map<string, string[]>()
    const order: string[] = []

    for (const item of items) {
        if (item.category_id !== categoryId) continue

        let descriptions = byTitle.get(item.title)
        if (!descriptions) {
            descriptions = []
            byTitle.set(item.title, descriptions)
            order.push(item.title)
        }
        descriptions.push(item.description)
    }

    return order.map((title) => ({
        categoryId,
        title,
        descriptions: byTitle.get(title)!,
    }))
}

/**
 * Groupes de saisie → éléments à enregistrer.
 *
 * Les groupes sans titre sont écartés : un titre vide produirait une ligne
 * anonyme, invisible dans l'affichage groupé par titre.
 */
export function groupsToItems(groups: TitleGroup[]): ChangelogItemInput[] {
    const items: ChangelogItemInput[] = []
    let position = 0

    for (const group of groups) {
        if (!group.title.trim()) continue

        for (const description of group.descriptions) {
            items.push({
                category_id: group.categoryId,
                title: group.title,
                description,
                position: position++,
            })
        }
    }

    return items
}

/** Une catégorie a-t-elle du contenu saisi (titre ou description) ? */
export function hasContent(groups: TitleGroup[]): boolean {
    return groups.some(
        (g) =>
            g.title.trim() !== "" || g.descriptions.some((d) => d.trim() !== "")
    )
}
