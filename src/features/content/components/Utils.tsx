import { type ToastFn } from "./interface"

export function extractErrorMessage(error: unknown): string | undefined {
    if (error instanceof Error) return error.message
    if (typeof error === "string") return error
    return undefined
}

export const fileConstraints = {
    allowedTypes: ["image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",],
}

export const handleFileSelect = (
    toast: ToastFn,
    event: React.ChangeEvent<HTMLInputElement>,
    multipleFiles: boolean,
    setSelectedFiles: React.Dispatch<React.SetStateAction<File[]>>,
    maxFiles?: number
) => {
    const files = Array.from(event.target.files || [])

    if (files.length === 0) return

    const invalidFiles = files.filter((file) => !file.type.startsWith("image/"))

    if (invalidFiles.length > 0) {
        toast.error("Erreur", { description: "Veuillez sélectionner uniquement des images" })
        return
    }

    let nextFiles = multipleFiles ? files : files.slice(0, 1)

    if (maxFiles && nextFiles.length > maxFiles) {
        toast.error("Trop de fichiers", { description: `Veuillez sélectionner au maximum ${maxFiles} photo(s).` })
        nextFiles = nextFiles.slice(0, maxFiles)
    }

    setSelectedFiles(nextFiles)
}

export const triggerFilePicker = (
    fileInputRefs: React.MutableRefObject<{
        [key: number]: HTMLInputElement | null
    }>,
    appId: number
) => {
    const input = fileInputRefs.current[appId]
    if (input) input.click()
}
