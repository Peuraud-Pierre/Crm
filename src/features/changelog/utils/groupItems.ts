import type {
    ChangelogCategory,
    ChangelogItemWithCategory,
    ChangelogVersionWithItems,
} from "../types/changelog.types"

/** Un titre et toutes les descriptions saisies sous ce titre. */
export interface TitleGroup {
    title: string
    descriptions: (string | null)[]
}

/** Une catégorie et ses titres, dans l'ordre de saisie. */
export interface CategoryGroup {
    category: ChangelogCategory
    titleGroups: TitleGroup[]
}

/**
 * Regroupe les éléments d'une version par catégorie, puis par titre.
 *
 * Cette fonction existait à l'identique — même corps, mêmes types
 * locaux — dans `Changelog.tsx` et dans `changelogCard.tsx`. Elle vit
 * désormais ici, seule.
 *
 * Les catégories sortent dans l'ordre de leur `position`, et les titres
 * dans leur ordre d'apparition (un titre répété regroupe ses
 * descriptions au lieu de créer un second bloc).
 */
export function groupItemsByCategory(
    items: ChangelogItemWithCategory[]
): CategoryGroup[] {
    const byCategory = new Map<
        string,
        { category: ChangelogCategory; items: ChangelogItemWithCategory[] }
    >()

    for (const item of items) {
        let bucket = byCategory.get(item.category_id)
        if (!bucket) {
            bucket = { category: item.category, items: [] }
            byCategory.set(item.category_id, bucket)
        }
        bucket.items.push(item)
    }

    return Array.from(byCategory.values())
        .sort((a, b) => a.category.position - b.category.position)
        .map(({ category, items: categoryItems }) => {
            const byTitle = new Map<string, (string | null)[]>()
            const order: string[] = []

            for (const item of categoryItems) {
                let descriptions = byTitle.get(item.title)
                if (!descriptions) {
                    descriptions = []
                    byTitle.set(item.title, descriptions)
                    order.push(item.title)
                }
                descriptions.push(item.description)
            }

            return {
                category,
                titleGroups: order.map((title) => ({
                    title,
                    descriptions: byTitle.get(title)!,
                })),
            }
        })
}

/** Nombre de descriptions réellement renseignées dans une catégorie. */
export function countDescriptions(titleGroups: TitleGroup[]): number {
    return titleGroups.reduce(
        (total, group) =>
            total + group.descriptions.filter((d) => d !== null).length,
        0
    )
}

/** Une version contient-elle le terme recherché (version, résumé, items) ? */
export function versionMatchesSearch(
    version: ChangelogVersionWithItems,
    search: string
): boolean {
    const needle = search.toLowerCase()
    if (version.version.toLowerCase().includes(needle)) return true
    if (version.summary?.toLowerCase().includes(needle)) return true

    return version.items.some(
        (item) =>
            item.title.toLowerCase().includes(needle) ||
            item.description?.toLowerCase().includes(needle)
    )
}

/** Restreint les éléments d'une version à une seule catégorie. */
export function filterVersionByCategory(
    version: ChangelogVersionWithItems,
    categoryId: string | null
): ChangelogVersionWithItems {
    if (!categoryId) return version
    return {
        ...version,
        items: version.items.filter((i) => i.category_id === categoryId),
    }
}
