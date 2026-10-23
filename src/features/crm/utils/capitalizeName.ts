// Met une majuscule en début de chaque mot d'un nom (prénom + nom), en
// conservant les séparateurs (espaces, traits d'union) et en normalisant le
// reste en minuscules (ex. "jean-PAUL dupont" -> "Jean-Paul Dupont").
export function capitalizeName(value: string): string {
    return value
        .toLowerCase()
        .replace(/(^|[\s-])(\p{L})/gu, (_, sep, char) => sep + char.toUpperCase())
}
