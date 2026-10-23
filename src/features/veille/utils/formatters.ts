/**
 * Formate une URL pour un affichage plus lisible
 * @param url - L'URL à formater
 * @returns Une version lisible de l'URL
 */
export const formatUrlForDisplay = (url: string): string => {
    try {
        const urlObj = new URL(url)
        // Retirer www. si présent
        const hostname = urlObj.hostname.replace(/^www\./, "")
        // Limiter la longueur du pathname
        const pathname =
            urlObj.pathname.length > 50
                ? urlObj.pathname.substring(0, 47) + "..."
                : urlObj.pathname

        return `${hostname}${pathname}`
    } catch {
        // Si l'URL est invalide, retourner telle quelle
        return url
    }
}

/**
 * Extrait le nom de domaine d'une URL
 * @param url - L'URL source
 * @returns Le nom de domaine sans www
 */
export const extractDomain = (url: string): string => {
    try {
        const urlObj = new URL(url)
        return urlObj.hostname.replace(/^www\./, "")
    } catch {
        return url
    }
}

/**
 * Formate une date en français
 * @param dateString - La date au format ISO
 * @param format - Format court ou long
 * @returns La date formatée
 */
export const formatDate = (
    dateString: string,
    format: "short" | "long" = "long"
): string => {
    const date = new Date(dateString)

    if (format === "short") {
        return date.toLocaleDateString("fr-FR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        })
    }

    return date.toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
    })
}

/**
 * Formate un score d'importance en label
 * @param score - Score de 1 à 10
 * @returns Le label correspondant
 */
export const getImportanceLabel = (score: number | null): string => {
    if (score === null) return "Non défini"
    if (score >= 7) return "Critique"
    if (score >= 5) return "Important"
    return "Normal"
}

/**
 * Retourne la couleur Tailwind pour un score d'importance
 * @param score - Score de 1 à 10
 * @returns La classe CSS de couleur
 */
export const getImportanceColor = (score: number | null): string => {
    if (score === null) return "bg-gray-500"
    if (score >= 7) return "bg-red-500"
    if (score >= 5) return "bg-orange-500"
    return "bg-blue-500"
}
