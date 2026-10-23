// Pont front → service Go (info_go) pour l'autocomplétion d'adresse.
// Le service proxifie l'API Base Adresse Nationale ; le front ne connaît
// que cet endpoint interne (cf. info/adresse.go).

// Base du service Go (info_go). Surchargée en dev via PUBLIC_INFO_API_URL
// (ex. http://localhost:8091) ; sinon la prod.
const INFO_API_BASE = "https://info.nokk-project.example"

interface AdresseSuggestResponse {
    suggestions?: string[]
}

/**
 * Récupère des suggestions d'adresse pour une saisie donnée.
 * @param query  Texte saisi (≥ 3 caractères, sinon retourne []).
 * @param signal AbortSignal optionnel pour annuler une requête en cours.
 * @param limit  Nombre max de suggestions (défaut 5).
 */
export async function fetchAddressSuggestions(
    query: string,
    signal?: AbortSignal,
    limit = 5
): Promise<string[]> {
    const q = query.trim()
    if (q.length < 3) return []

    const url = `${INFO_API_BASE}/api/adresse?q=${encodeURIComponent(
        q
    )}&limit=${limit}`

    const res = await fetch(url, { method: "GET", signal })
    if (!res.ok) throw new Error(`Adresse API: ${res.status}`)

    const data = (await res.json()) as AdresseSuggestResponse
    return Array.isArray(data.suggestions) ? data.suggestions : []
}
