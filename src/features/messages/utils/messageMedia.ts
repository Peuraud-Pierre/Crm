import type { CryptedMessage } from "../hooks/useCryptedChat"

/**
 * Familles de pièces jointes ayant un rendu riche.
 *
 * Le reste (PDF, archives, bureautique…) garde la ligne de fichier
 * téléchargeable de `MessageAttachment`.
 */
export type MediaKind = "image" | "video" | "audio"

/**
 * Types que le navigateur ne sait pas rendre nativement malgré un MIME de la
 * bonne famille. Sans cette liste, un `.mov` ProRes ou un HEIC affichaient un
 * lecteur vide ou une image cassée au lieu d'un lien de téléchargement — c'est
 * l'origine du rendu « qui varie selon le format ».
 */
const UNPLAYABLE_MIMES = new Set([
    // Safari les affiche, pas Chrome ni Firefox : mieux vaut proposer le
    // téléchargement partout que d'afficher un cadre vide selon le navigateur.
    "image/heic",
    "image/heif",
    "image/x-icon",
    "video/quicktime",
    "video/x-msvideo",
    "video/x-matroska",
    "audio/x-ms-wma",
])

/**
 * SVG : rendu en `<img>`, donc sans script actif, mais il reste un format
 * vectoriel dont le contenu vient d'un tiers. On le traite comme une image
 * puisque le blob est déchiffré localement et servi en `blob:` — même origine
 * isolée, pas d'accès au DOM de l'application.
 */
export function getMediaKind(mime?: string | null): MediaKind | null {
    if (!mime) return null
    const normalized = mime.split(";")[0].trim().toLowerCase()
    if (UNPLAYABLE_MIMES.has(normalized)) return null
    if (normalized.startsWith("image/")) return "image"
    if (normalized.startsWith("video/")) return "video"
    if (normalized.startsWith("audio/")) return "audio"
    return null
}

/** Média visuel : ce qui peut entrer dans une mosaïque et dans la visionneuse. */
export function isVisualMedia(mime?: string | null): boolean {
    const kind = getMediaKind(mime)
    return kind === "image" || kind === "video"
}

/** Variante tolérante au MIME manquant, pour un message déjà déchiffré. */
export function isVisualMediaMessage(message: CryptedMessage): boolean {
    const kind = resolveMessageMediaKind(message)
    return kind === "image" || kind === "video"
}

/**
 * URL exploitable d'une pièce jointe, quelle que soit la famille.
 *
 * Les hooks rangent le blob déchiffré dans `image_url` pour les images et dans
 * `file_url` pour tout le reste. Une vidéo se retrouvait donc dans `file_url`
 * et n'était rendue que comme un lien de téléchargement.
 */
export function getMediaUrl(message: CryptedMessage): string | undefined {
    return message.image_url ?? message.file_url
}

/**
 * Famille d'un message, MIME manquant compris.
 *
 * Les hooks ne remplissent `image_url` que pour les images : une ligne
 * ancienne dont le `content_type` n'a pas été enregistré reste donc affichable
 * comme image. Sans ce repli, elle retomberait en message texte vide.
 */
export function resolveMessageMediaKind(
    message: CryptedMessage
): MediaKind | null {
    return getMediaKind(message.file_mime) ?? (message.image_url ? "image" : null)
}

/** Un média visuel prêt à être affiché (blob déchiffré disponible). */
export function isRenderableVisualMedia(message: CryptedMessage): boolean {
    return (
        !message.deleted_at &&
        !message.attachment_error &&
        isVisualMediaMessage(message) &&
        !!getMediaUrl(message)
    )
}
