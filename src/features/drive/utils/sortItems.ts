import type { DriveItem } from "@/features/drive/types"

export const SORT_KEYS = [
    "name-asc",
    "name-desc",
    "date-desc",
    "date-asc",
    "size-desc",
    "size-asc",
] as const

export type SortKey = (typeof SORT_KEYS)[number]

export const SORT_LABELS: Record<SortKey, string> = {
    "name-asc": "Nom (A → Z)",
    "name-desc": "Nom (Z → A)",
    "date-desc": "Plus récents",
    "date-asc": "Plus anciens",
    "size-desc": "Plus volumineux",
    "size-asc": "Moins volumineux",
}

/**
 * Trie le contenu d'un dossier.
 *
 * Les dossiers restent toujours en tête, quel que soit le critère : c'est la
 * convention de tous les explorateurs de fichiers, et trier un dossier par
 * taille n'aurait de toute façon aucun sens — il n'en a pas.
 *
 * Le tri est stable et ne mute pas l'entrée.
 */
export function sortItems(items: DriveItem[], key: SortKey): DriveItem[] {
    const collator = new Intl.Collator("fr", {
        sensitivity: "base",
        numeric: true,
    })

    const compare = (a: DriveItem, b: DriveItem): number => {
        switch (key) {
            case "name-asc":
                return collator.compare(a.title ?? "", b.title ?? "")
            case "name-desc":
                return collator.compare(b.title ?? "", a.title ?? "")
            case "date-desc":
                return (b.createdAt ?? "").localeCompare(a.createdAt ?? "")
            case "date-asc":
                return (a.createdAt ?? "").localeCompare(b.createdAt ?? "")
            case "size-desc":
                return (b.sizeBytes ?? 0) - (a.sizeBytes ?? 0)
            case "size-asc":
                return (a.sizeBytes ?? 0) - (b.sizeBytes ?? 0)
        }
    }

    return [...items].sort((a, b) => {
        const folderGap = Number(!!b.isFolder) - Number(!!a.isFolder)
        if (folderGap !== 0) return folderGap
        return compare(a, b)
    })
}
