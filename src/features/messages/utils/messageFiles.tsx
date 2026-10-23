import type { ReactNode } from "react"

export type FileKind =
    | "image"
    | "pdf"
    | "audio"
    | "video"
    | "archive"
    | "doc"
    | "sheet"
    | "slides"
    | "file"

const AUDIO_PREFIX = "audio/"
const VIDEO_PREFIX = "video/"
const IMAGE_PREFIX = "image/"

export function getFileKind(mime?: string | null): FileKind {
    if (!mime) return "file"
    if (mime.startsWith(IMAGE_PREFIX)) return "image"
    if (mime === "application/pdf") return "pdf"
    if (mime.startsWith(AUDIO_PREFIX)) return "audio"
    if (mime.startsWith(VIDEO_PREFIX)) return "video"
    if (
        mime === "application/zip" ||
        mime === "application/x-zip-compressed" ||
        mime === "application/x-7z-compressed"
    )
        return "archive"
    if (
        mime ===
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        mime === "application/msword"
    )
        return "doc"
    if (
        mime ===
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
        mime === "application/vnd.ms-excel"
    )
        return "sheet"
    if (
        mime ===
            "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
        mime === "application/vnd.ms-powerpoint"
    )
        return "slides"
    return "file"
}

export type IconRenderer = (className?: string) => ReactNode

export type FileIconMap = Record<FileKind, IconRenderer>

/**
 * Ratio largeur/hauteur d'une image, lu depuis `meta` si l'expéditeur l'a
 * écrit. Renvoie `null` pour les messages antérieurs à cet ajout — l'appelant
 * retombe alors sur un cadre par défaut.
 */
export function getMetaAspectRatio(
    meta?: { width?: number; height?: number } | null
): number | null {
    if (!meta?.width || !meta.height) return null
    if (meta.width <= 0 || meta.height <= 0) return null
    return meta.width / meta.height
}
