const MAX_DIMENSION = 1920
const JPEG_QUALITY = 0.85
const SKIPPED_TYPES = new Set(["image/gif", "image/svg+xml"])

export async function compressImage(file: File): Promise<File> {
    if (!file.type.startsWith("image/")) return file
    if (SKIPPED_TYPES.has(file.type)) return file
    if (typeof createImageBitmap !== "function") return file

    let bitmap: ImageBitmap
    try {
        bitmap = await createImageBitmap(file, {
            imageOrientation: "from-image",
        })
    } catch {
        return file
    }

    try {
        const scale = Math.min(
            1,
            MAX_DIMENSION / Math.max(bitmap.width, bitmap.height)
        )
        const width = Math.max(1, Math.round(bitmap.width * scale))
        const height = Math.max(1, Math.round(bitmap.height * scale))

        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext("2d")
        if (!ctx) return file
        ctx.drawImage(bitmap, 0, 0, width, height)

        const blob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
        )
        if (!blob || blob.size >= file.size) return file

        const baseName = file.name.replace(/\.[^.]+$/, "")
        return new File([blob], `${baseName}.jpg`, {
            type: "image/jpeg",
            lastModified: Date.now(),
        })
    } finally {
        bitmap.close()
    }
}

/**
 * Dimensions en pixels d'un fichier image, ou `null` si ce n'en est pas une
 * (ou si le décodage échoue). Écrites dans `meta` à l'envoi pour que le
 * destinataire puisse réserver la place de la vignette.
 */
export async function readImageDimensions(
    file: File
): Promise<{ width: number; height: number } | null> {
    if (!file.type.startsWith("image/")) return null
    if (typeof createImageBitmap !== "function") return null
    try {
        const bitmap = await createImageBitmap(file)
        const dimensions = { width: bitmap.width, height: bitmap.height }
        bitmap.close()
        return dimensions
    } catch {
        return null
    }
}
