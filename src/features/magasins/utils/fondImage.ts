// Préparation du fond de plan : un PDF est rendu en PNG (première page), une
// photo est réduite et réencodée en JPEG, dans le navigateur, avant l'envoi
// au bucket `magasin-plans`. pdf.js n'est chargé qu'au premier PDF.

import type { FondCalage } from "@/features/magasins/types/magasin.types"

/** Plus grand côté de l'image envoyée : assez fin pour décalquer au cm près. */
export const FOND_MAX_SIDE = 3000
/** Limite du bucket (migration 20261008100000). */
export const FOND_MAX_BYTES = 10 * 1024 * 1024

export interface FondImage {
    blob: Blob
    extension: "png" | "jpg"
    width: number
    height: number
}

export class FondImageError extends Error {}

export function isPdf(file: File): boolean {
    return file.type === "application/pdf" || /\.pdf$/i.test(file.name)
}

function isImage(file: File): boolean {
    return ["image/png", "image/jpeg"].includes(file.type) || /\.(png|jpe?g)$/i.test(file.name)
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
    return new Promise((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new FondImageError("Encodage de l'image impossible."))), type, quality),
    )
}

async function renderPdf(file: File): Promise<FondImage> {
    const pdfjs = await import("pdfjs-dist")
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString()
    // pdfjs 6 : seule la tâche de chargement expose destroy() (libère le worker).
    const task = pdfjs.getDocument({ data: await file.arrayBuffer() })
    let doc
    try {
        doc = await task.promise
    } catch {
        void task.destroy()
        throw new FondImageError(`PDF illisible : ${file.name}`)
    }
    try {
        const page = await doc.getPage(1)
        const base = page.getViewport({ scale: 1 })
        const scale = FOND_MAX_SIDE / Math.max(base.width, base.height)
        const viewport = page.getViewport({ scale })
        const canvas = document.createElement("canvas")
        canvas.width = Math.round(viewport.width)
        canvas.height = Math.round(viewport.height)
        const context = canvas.getContext("2d")
        if (!context) throw new FondImageError("Canvas indisponible.")
        await page.render({ canvas, canvasContext: context, viewport }).promise
        return { blob: await canvasToBlob(canvas, "image/png"), extension: "png", width: canvas.width, height: canvas.height }
    } finally {
        void task.destroy()
    }
}

async function renderPhoto(file: File): Promise<FondImage> {
    let bitmap: ImageBitmap
    try {
        bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
    } catch {
        throw new FondImageError(`Image illisible : ${file.name}`)
    }
    try {
        const scale = Math.min(1, FOND_MAX_SIDE / Math.max(bitmap.width, bitmap.height))
        const canvas = document.createElement("canvas")
        canvas.width = Math.max(1, Math.round(bitmap.width * scale))
        canvas.height = Math.max(1, Math.round(bitmap.height * scale))
        const context = canvas.getContext("2d")
        if (!context) throw new FondImageError("Canvas indisponible.")
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
        return { blob: await canvasToBlob(canvas, "image/jpeg", 0.9), extension: "jpg", width: canvas.width, height: canvas.height }
    } finally {
        bitmap.close()
    }
}

/** Convertit le fichier déposé en image de fond, ou explique le refus. */
export async function toFondImage(file: File): Promise<FondImage> {
    let image: FondImage
    if (isPdf(file)) image = await renderPdf(file)
    else if (isImage(file)) image = await renderPhoto(file)
    else throw new FondImageError(`${file.name} : format non pris en charge (PDF, JPEG ou PNG).`)
    if (image.blob.size > FOND_MAX_BYTES) {
        throw new FondImageError("Plan trop lourd une fois converti (10 Mo au maximum).")
    }
    return image
}

/**
 * Calage par défaut : l'image entière dans l'emprise du magasin, proportions
 * gardées, collée au coin haut-gauche. L'utilisateur ajuste ensuite.
 */
export function defaultCalage(
    image: { width: number; height: number },
    bounds: { width: number; depth: number },
    opacity = 0.5,
): FondCalage {
    const ratio = image.width / image.height
    const width = Math.min(bounds.width, bounds.depth * ratio)
    const round = (v: number) => Math.round(v * 100) / 100
    return {
        fond_x: 0,
        fond_y: 0,
        fond_largeur: round(width),
        fond_profondeur: round(width / ratio),
        fond_opacite: opacity,
    }
}
