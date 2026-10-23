/**
 * Plafond d'ids par filtre `.in()` : le proxy api.nokk-project.example rejette
 * les URL trop longues au-delà d'une quarantaine d'uuids — et l'erreur se
 * présente comme une erreur CORS. Tout filtre sur une liste d'ids non bornée
 * est découpé à cette taille.
 */
export const IN_FILTER_MAX = 40

export function chunk<T>(items: readonly T[], size: number): T[][] {
    const parts: T[][] = []
    for (let i = 0; i < items.length; i += size) parts.push(items.slice(i, i + size))
    return parts
}
