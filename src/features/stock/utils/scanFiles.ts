// Préparation des fichiers envoyés à scan-doc (voir services/scanDocService.ts).
//
// Les photos de téléphone pèsent 3 à 8 Mo et portent leur orientation dans
// l'EXIF, que le service n'applique pas : chaque photo est redressée, réduite
// et réencodée en JPEG ici, avant l'envoi. Les PDF passent tels quels.

/** Limites du service, pour refuser avant l'envoi plutôt qu'après. */
export const SCAN_LIMITS = {
    maxBytes: 20 * 1024 * 1024,
    maxFiles: 40,
    /** Plus grand côté d'une photo envoyée : au-delà, le modèle ne lit pas mieux. */
    maxSide: 2400,
    jpegQuality: 0.85,
} as const

export const SCAN_ACCEPT = "application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"

export type ScanFileKind = "pdf" | "image"

export type ScanFileCheck = { kind: ScanFileKind } | { error: string }

function extension(name: string): string {
    const dot = name.lastIndexOf(".")
    return dot === -1 ? "" : name.slice(dot + 1).toLowerCase()
}

/** Classe un fichier choisi, ou dit pourquoi il est refusé. */
export function classifyScanFile(file: File): ScanFileCheck {
    const ext = extension(file.name)
    const type = file.type.toLowerCase()
    if (type === "application/pdf" || ext === "pdf") return { kind: "pdf" }
    if (type === "image/jpeg" || type === "image/png" || ["jpg", "jpeg", "png"].includes(ext)) {
        return { kind: "image" }
    }
    if (type === "image/heic" || type === "image/heif" || ext === "heic" || ext === "heif") {
        return { error: `${file.name} : les photos HEIC ne sont pas prises en charge, exportez-les en JPEG.` }
    }
    return { error: `${file.name} : format non pris en charge (PDF, JPEG ou PNG).` }
}

export function formatBytes(bytes: number): string {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`
    return `${(bytes / (1024 * 1024)).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`
}

/**
 * Redresse (EXIF), réduit et réencode une photo en JPEG. Lève une erreur si le
 * navigateur ne sait pas la décoder.
 */
export async function compressImage(file: File): Promise<File> {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
    try {
        const scale = Math.min(1, SCAN_LIMITS.maxSide / Math.max(bitmap.width, bitmap.height))
        const width = Math.max(1, Math.round(bitmap.width * scale))
        const height = Math.max(1, Math.round(bitmap.height * scale))

        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext("2d")
        if (!ctx) throw new Error("canvas indisponible")
        // Fond blanc : un PNG transparent deviendrait noir en JPEG.
        ctx.fillStyle = "white"
        ctx.fillRect(0, 0, width, height)
        ctx.drawImage(bitmap, 0, 0, width, height)

        const blob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob(resolve, "image/jpeg", SCAN_LIMITS.jpegQuality),
        )
        if (!blob) throw new Error("encodage JPEG impossible")
        const base = file.name.replace(/\.[^.]+$/, "")
        return new File([blob], `${base}.jpg`, { type: "image/jpeg" })
    } finally {
        bitmap.close()
    }
}
