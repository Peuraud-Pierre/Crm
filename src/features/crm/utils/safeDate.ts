/**
 * Crée un objet Date valide ou renvoie null si la valeur est invalide.
 * Protège contre les crashs "Invalid time value" quand les données Supabase sont null/undefined/"".
 */
export function safeDate(value: unknown): Date | null {
    if (value == null || value === "") return null
    const d = new Date(value as string | number)
    return isNaN(d.getTime()) ? null : d
}

/**
 * Renvoie un timestamp numérique sûr pour les tris.
 * Les valeurs invalides sont envoyées à 0 (epoch) pour ne pas casser les comparaisons.
 */
export function safeDateMs(value: unknown): number {
    const d = safeDate(value)
    return d ? d.getTime() : 0
}
