/**
 * « 12,5 » ou « 12.5 » → 12.5 ; `null` si ce n'est pas un poids positif à
 * deux décimales au plus. Partagé par les saisies en kg (salle de tri,
 * cartons des commandes) : pendant la frappe le poids reste du texte,
 * converti seulement à l'enregistrement.
 */
export function parsePoids(raw: string): number | null {
    const value = raw.trim().replace(",", ".")
    if (!/^\d+(\.\d{1,2})?$/.test(value)) return null
    const n = Number(value)
    return n > 0 ? n : null
}
