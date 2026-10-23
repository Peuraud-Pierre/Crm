import type { VeilleExecutiveSummary } from "../types/veille.types"

/**
 * Valide et parse un executive summary JSON
 * @param jsonString - La chaîne JSON à parser
 * @returns L'objet parsé ou null si invalide
 */
export const parseExecutiveSummary = (
    jsonString: string | null | undefined
): VeilleExecutiveSummary | null => {
    if (!jsonString || !jsonString.trim()) {
        return null
    }

    try {
        // Nettoyer les éventuels marqueurs markdown
        const cleaned = jsonString.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim()

        // Vérifier si ça ressemble à du JSON (commence par { ou [)
        if (!cleaned.startsWith("{") && !cleaned.startsWith("[")) {
            // Ce n'est pas du JSON, c'est du texte simple
            return null
        }

        const parsed = JSON.parse(cleaned)

        // Validation basique de la structure
        if (
            !parsed ||
            typeof parsed !== "object" ||
            !parsed.date_veille ||
            !parsed.periode
        ) {
            return null
        }

        // S'assurer que les tableaux existent
        return {
            date_veille: parsed.date_veille,
            periode: parsed.periode,
            secteurs_cibles: Array.isArray(parsed.secteurs_cibles)
                ? parsed.secteurs_cibles
                : [],
            actualites_principales: Array.isArray(parsed.actualites_principales)
                ? parsed.actualites_principales
                : [],
            sections: Array.isArray(parsed.sections) ? parsed.sections : [],
        }
    } catch {
        // Silencieux - le texte n'est simplement pas du JSON structuré
        return null
    }
}

/**
 * Vérifie si un rapport de veille a un executive summary valide
 * @param executiveSummary - Le résumé à vérifier
 * @returns true si le résumé est valide
 */
export const hasValidExecutiveSummary = (
    executiveSummary: string | null | undefined
): boolean => {
    return parseExecutiveSummary(executiveSummary) !== null
}
