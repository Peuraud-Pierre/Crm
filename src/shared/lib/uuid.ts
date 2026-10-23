/**
 * Génère un UUID v4 utilisable dans tous les contextes.
 *
 * `crypto.randomUUID()` n'existe qu'en *contexte sécurisé* (HTTPS ou
 * localhost). Sur un serveur de dev exposé en LAN et consulté en `http://`
 * depuis un téléphone, l'appel lève `TypeError: crypto.randomUUID is not a
 * function`. On retombe alors sur `crypto.getRandomValues`, lui disponible
 * hors contexte sécurisé, pour construire un UUID v4 conforme (RFC 4122).
 */
export function safeRandomUUID(): string {
    if (
        typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function"
    ) {
        return crypto.randomUUID()
    }

    const bytes = crypto.getRandomValues(new Uint8Array(16))
    bytes[6] = (bytes[6] & 0x0f) | 0x40 // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80 // variant 10xx

    const hex: string[] = []
    for (let i = 0; i < 256; i++) hex.push((i + 0x100).toString(16).slice(1))

    return (
        hex[bytes[0]] +
        hex[bytes[1]] +
        hex[bytes[2]] +
        hex[bytes[3]] +
        "-" +
        hex[bytes[4]] +
        hex[bytes[5]] +
        "-" +
        hex[bytes[6]] +
        hex[bytes[7]] +
        "-" +
        hex[bytes[8]] +
        hex[bytes[9]] +
        "-" +
        hex[bytes[10]] +
        hex[bytes[11]] +
        hex[bytes[12]] +
        hex[bytes[13]] +
        hex[bytes[14]] +
        hex[bytes[15]]
    )
}
