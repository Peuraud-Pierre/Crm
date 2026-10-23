import type { Permission } from "../types"

export interface PermissionGroup {
    label: string
    perms: Permission[]
}

export function groupByCategory(perms: Permission[]): PermissionGroup[] {
    const map = new Map<string, PermissionGroup>()
    for (const p of perms) {
        const label = p.category?.trim() || "Autres"
        const key = label.toLowerCase()
        const entry = map.get(key) ?? { label, perms: [] }
        entry.perms.push(p)
        map.set(key, entry)
    }
    return Array.from(map.values())
        .map((g) => ({
            ...g,
            perms: g.perms
                .slice()
                .sort((a, b) => a.label.localeCompare(b.label)),
        }))
        .sort((a, b) => a.label.localeCompare(b.label))
}

/** Filtre de recherche commun (label / code / catégorie). */
export function matchesPermissionSearch(p: Permission, query: string): boolean {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return (
        p.label.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        (p.category ?? "").toLowerCase().includes(q)
    )
}
