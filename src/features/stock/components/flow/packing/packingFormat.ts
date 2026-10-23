const numberFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 })

export const EMPTY = "—"

export function formatNumber(value: number | null | undefined): string {
    return value === null || value === undefined ? EMPTY : numberFormatter.format(value)
}

export function formatKg(value: number | null | undefined): string {
    return value === null || value === undefined ? EMPTY : `${numberFormatter.format(value)} kg`
}

export function formatQty(value: number | null | undefined): string {
    return value === null || value === undefined ? EMPTY : `${numberFormatter.format(value)} pcs`
}

/**
 * Nombre de colis. C'est la grandeur de référence d'une packing list : la
 * seule qui s'additionne et la seule que le fournisseur totalise lui-même.
 */
export function formatPackages(value: number | null | undefined): string {
    if (value === null || value === undefined) return EMPTY
    return `${numberFormatter.format(value)} colis`
}

/**
 * Contenu d'un colis, dans son régime d'unité. Une ligne se lit
 * « 200 pcs × 20 colis », l'autre « 25 kg × 3 colis ».
 */
export function formatUnitsPerPackage(
    value: number | null | undefined,
    kind: "pcs" | "kgs" | null | undefined,
): string {
    if (value === null || value === undefined || !kind) return EMPTY
    return kind === "kgs" ? formatKg(value) : formatQty(value)
}

/**
 * Les chiffres d'une ligne sur UNE ligne de texte, pour les écrans étroits :
 * « L12 · 200 pcs × 20 colis = 4 000 ».
 *
 * Sous 640 px, la grille de douze colonnes réduit chaque cellule à une vingtaine
 * de pixels : le libellé se tronque à trois caractères et le sélecteur devient
 * intappable. Les nombres passent donc en une phrase, et les colonnes ne
 * réapparaissent qu'au-dessus.
 */
export function formatLineMeta(parts: {
    sourceRow: number
    unitsPerPackage: number | null
    unitKind: "pcs" | "kgs" | null
    packageCount: number | null
    declaredTotal: number | null
}): string {
    const units = formatUnitsPerPackage(parts.unitsPerPackage, parts.unitKind)
    const packages = formatPackages(parts.packageCount)
    const total = formatNumber(parts.declaredTotal)

    const product = units === EMPTY ? packages : `${units} × ${packages}`
    return `L${parts.sourceRow} · ${product} = ${total}`
}

/** Écart signé : « +340 », « −12 », « 0 ». */
export function formatSigned(value: number): string {
    if (value === 0) return "0"
    return `${value > 0 ? "+" : "−"}${numberFormatter.format(Math.abs(value))}`
}

export function formatConfidence(value: number | null): string | null {
    return value === null ? null : `${Math.round(value * 100)} %`
}
