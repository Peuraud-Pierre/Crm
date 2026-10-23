import { useCallback, useEffect, useState } from "react"

/**
 * Fichiers réellement transportés par un glisser.
 *
 * Firefox laisse `files` vide dès que la source n'est pas le système de
 * fichiers (image tirée d'une page ou d'un autre onglet) : le fichier n'existe
 * alors que dans `items`, à réclamer par `getAsFile()`. Chromium remplit les
 * deux — d'où un dépôt qui marchait ici et restait sans effet là. Même
 * extraction que le collage (`useMessageComposer.handlePaste`).
 */
export function filesFromDataTransfer(dt: DataTransfer): File[] {
    const files = Array.from(dt.files ?? [])
    if (files.length > 0) return files

    return Array.from(dt.items ?? [])
        .filter((item) => item.kind === "file")
        .map((item) => item.getAsFile())
        .filter((file): file is File => file !== null)
}

/**
 * Gère une zone de dépôt de fichiers (drag-and-drop natif).
 * Retourne l'état visuel `isDragActive` et les handlers à étaler
 * sur l'élément conteneur.
 */
export function useFileDropZone({
    enabled,
    onFiles,
}: {
    enabled: boolean
    onFiles: (files: File[]) => void
}) {
    const [isDragActive, setIsDragActive] = useState(false)

    // Filet de sécurité : un glisser abandonné (Échap, dépôt hors de la
    // fenêtre) ne produit aucun `dragleave` sur la zone. Sans ça, le voile
    // restait affiché jusqu'au rechargement de la page.
    useEffect(() => {
        if (!isDragActive) return
        const clear = () => setIsDragActive(false)
        window.addEventListener("dragend", clear)
        window.addEventListener("drop", clear)
        return () => {
            window.removeEventListener("dragend", clear)
            window.removeEventListener("drop", clear)
        }
    }, [isDragActive])

    const onDragEnter = useCallback(
        (event: React.DragEvent<HTMLElement>) => {
            if (!enabled) return
            if (!event.dataTransfer.types.includes("Files")) return
            setIsDragActive(true)
        },
        [enabled]
    )

    const onDragOver = useCallback(
        (event: React.DragEvent<HTMLElement>) => {
            if (!enabled) return
            if (!event.dataTransfer.types.includes("Files")) return
            // Sans preventDefault, le navigateur ouvre le fichier dans l'onglet.
            event.preventDefault()
            event.dataTransfer.dropEffect = "copy"
            if (!isDragActive) setIsDragActive(true)
        },
        [enabled, isDragActive]
    )

    // `dragleave` part aussi en passant d'un enfant à l'autre : `relatedTarget`
    // est alors encore dans la zone. Un compteur d'entrées/sorties en plus de
    // ce test ne pouvait pas retomber à zéro — chaque enfant survolé
    // l'incrémentait sans décrément en face — et le voile restait affiché.
    const onDragLeave = useCallback(
        (event: React.DragEvent<HTMLElement>) => {
            if (!enabled) return
            if (
                event.currentTarget.contains(event.relatedTarget as Node | null)
            )
                return
            setIsDragActive(false)
        },
        [enabled]
    )

    const onDrop = useCallback(
        (event: React.DragEvent<HTMLElement>) => {
            if (!enabled) return
            event.preventDefault()
            setIsDragActive(false)
            const files = filesFromDataTransfer(event.dataTransfer)
            if (files.length > 0) onFiles(files)
        },
        [enabled, onFiles]
    )

    return {
        isDragActive,
        dropHandlers: { onDragEnter, onDragOver, onDragLeave, onDrop },
    }
}
