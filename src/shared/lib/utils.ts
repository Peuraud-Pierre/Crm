import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export async function downloadFile(url: string, filename: string) {
    const res = await fetch(url)
    // Sans ce contrôle, une réponse d'erreur est enregistrée telle quelle et
    // l'utilisateur récupère un fichier contenant le JSON de l'erreur au lieu
    // du document attendu.
    if (!res.ok) {
        throw new Error(`Téléchargement impossible (HTTP ${res.status})`)
    }
    const blob = await res.blob()
    const blobUrl = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = blobUrl
    a.download = filename
    a.click()
    window.URL.revokeObjectURL(blobUrl)
}
