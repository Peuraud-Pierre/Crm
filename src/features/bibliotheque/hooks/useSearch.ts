// ── hooks/useSearch.ts ────────────────────────────────────────────────────────
// RÔLE : Gère toute la logique de la barre de recherche.
//
// Ce hook prend les données brutes (thématiques et Q&R) en entrée, et expose :
//   - searchQuery / setSearchQuery : le texte saisi dans la barre de recherche
//   - searchGroups : les résultats de recherche filtrés et groupés par thématique
//   - detailQRId / detailQR : la Q&R sélectionnée dans les résultats (affichée à droite)
//   - handleNavigate : quitte la recherche et navigue vers une thématique
//   - clearSearch : ferme la vue recherche sans naviguer
//
// Particularité technique — le debounce :
//   La recherche n'est PAS lancée à chaque frappe de l'utilisateur.
//   On attend 150ms d'inactivité avant de filtrer (pour ne pas surcharger
//   le navigateur si l'utilisateur tape vite). Ce délai s'appelle un "debounce".
//   Pendant ces 150ms, searchQuery est mis à jour (la barre montre le texte en temps
//   réel), mais debouncedQuery reste à l'ancienne valeur.
//
// CE FICHIER EST IMPORTÉ PAR :
//   - hooks/useBiblioPage.ts → appelle useSearch et expose ses résultats via le contexte

import { useState, useMemo, useCallback, useEffect } from "react"
import type { Lang, QR, Thematique } from "../types"
import { tLabel, tQuestion, tReponse } from "../utils"

interface UseSearchParams {
    thematiques: Thematique[]
    questionsReponses: QR[]
    lang: Lang
    setActiveId: (id: string) => void
}

export function useSearch({ thematiques, questionsReponses, lang, setActiveId }: UseSearchParams) {
    // searchQuery : ce que l'utilisateur tape (mis à jour à chaque frappe)
    const [searchQuery, setSearchQuery]   = useState("")
    // debouncedQuery : valeur décalée de 150ms (utilisée pour le filtrage)
    const [debouncedQuery, setDebouncedQuery] = useState("")
    // detailQRId : identifiant de la Q&R sélectionnée dans les résultats (null = rien)
    const [detailQRId, setDetailQRId]     = useState<string | null>(null)

    // Debounce : chaque fois que searchQuery change, on programme une mise à jour
    // de debouncedQuery dans 150ms. Si searchQuery change à nouveau avant les 150ms,
    // on annule le premier timer (clearTimeout) et on en recrée un.
    // Résultat : debouncedQuery ne se met à jour que 150ms après la DERNIÈRE frappe.
    useEffect(() => {
        const id = setTimeout(() => setDebouncedQuery(searchQuery), 150)
        return () => clearTimeout(id) // annule le timer si le composant se démonte
    }, [searchQuery])

    // qrsByThematique : regroupe une bonne fois pour toutes les Q&R par thématique
    // (Map<thematiqueId, QR[]>), recalculé uniquement quand questionsReponses
    // change (pas à chaque frappe). Sans ce regroupement, searchGroups devrait
    // reparcourir la totalité de questionsReponses pour CHAQUE thématique — un
    // coût en thematiques × Q&R. Avec la Map, chaque Q&R n'est visité qu'une
    // seule fois au total (coût en thematiques + Q&R), quel que soit le nombre
    // de thématiques.
    const qrsByThematique = useMemo(() => {
        const map = new Map<string, QR[]>()
        for (const qr of questionsReponses) {
            const list = map.get(qr.thematiqueId)
            if (list) list.push(qr)
            else map.set(qr.thematiqueId, [qr])
        }
        return map
    }, [questionsReponses])

    // detailQR : retrouve l'objet QR complet à partir de son id.
    // useMemo recalcule uniquement quand detailQRId ou questionsReponses changent.
    // ?? null : si find() ne trouve rien (suppression concurrente), on retourne null.
    const detailQR = useMemo(
        () => detailQRId
            ? questionsReponses.find((qr) => qr.id === detailQRId) ?? null
            : null,
        [detailQRId, questionsReponses],
    )

    // detailThematique : retrouve la thématique parente de detailQR.
    // Utile pour afficher le fil d'Ariane dans QRDetailPanel.
    const detailThematique = useMemo(
        () => detailQR
            ? thematiques.find((t) => t.id === detailQR.thematiqueId)
            : undefined,
        [detailQR, thematiques],
    )

    // searchGroups : résultats de recherche groupés par thématique.
    // Recalculé à chaque fois que debouncedQuery, les données ou la langue changent.
    // Stratégie :
    //   - Si le NOM de la thématique contient la recherche → toutes ses Q&R s'affichent
    //   - Sinon → seules les Q&R dont question ou réponse contient la recherche s'affichent
    //   - Les thématiques dont le nom match passent en premier (.sort)
    //   - Les thématiques sans aucun match sont exclues (return null + .filter)
    const searchGroups = useMemo(() => {
        const q = debouncedQuery.trim().toLowerCase()
        if (!q) return [] // pas de recherche active → aucun groupe à afficher

        return thematiques
            .map((t) => {
                // true si le libellé de la thématique contient le texte cherché
                const isThematiqueMatch = tLabel(t, lang).toLowerCase().includes(q)

                // Q&R de cette seule thématique (déjà pré-regroupées, voir qrsByThematique) —
                // on ne reparcourt jamais les Q&R des AUTRES thématiques ici.
                const ownQRs = qrsByThematique.get(t.id) ?? []

                // Si la thématique elle-même correspond → on montre TOUTES ses Q&R
                // Sinon → on ne montre que celles dont la question ou la réponse contient q
                const questionsReponsesToShow = isThematiqueMatch
                    ? ownQRs
                    : ownQRs.filter(
                        (qr) =>
                            tQuestion(qr, lang).toLowerCase().includes(q) ||
                            tReponse(qr, lang).toLowerCase().includes(q)
                    )

                // Ni la thématique ni ses Q&R ne correspondent → on exclut ce groupe
                if (!isThematiqueMatch && questionsReponsesToShow.length === 0) return null

                return { thematique: t, questionsReponses: questionsReponsesToShow, isThematiqueMatch }
            })
            // Retire les entrées null (thématiques sans match)
            .filter((g): g is NonNullable<typeof g> => g !== null)
            // Les thématiques avec match de nom passent avant les autres
            // Number(true) = 1, Number(false) = 0 → tri décroissant sur isThematiqueMatch
            .sort((a, b) => Number(b.isThematiqueMatch) - Number(a.isThematiqueMatch))
    }, [debouncedQuery, thematiques, qrsByThematique, lang])

    // Quitte la recherche et navigue vers une thématique spécifique.
    // Les deux états sont vidés immédiatement sans passer par le debounce.
    const handleNavigate = useCallback((id: string) => {
        setSearchQuery("")
        setDebouncedQuery("")
        setDetailQRId(null)
        setActiveId(id)
    }, [setActiveId])

    // Ferme la vue recherche sans naviguer (bouton "Retour").
    // Reset immédiat des deux états — pas de délai debounce.
    const clearSearch = useCallback(() => {
        setSearchQuery("")
        setDebouncedQuery("")
        setDetailQRId(null)
    }, [])

    return {
        searchQuery, setSearchQuery,
        // debouncedQuery est exposé pour le surlignage (highlight) des résultats :
        // searchGroups est calculé à partir de debouncedQuery, donc le texte qui
        // sert à surligner doit être LE MÊME texte, sous peine de surligner un mot
        // différent de celui qui a produit les résultats affichés (voir SearchResults.tsx
        // et QRDetailPanel.tsx, qui utilisent debouncedQuery et non searchQuery).
        debouncedQuery,
        detailQRId, setDetailQRId,
        detailQR, detailThematique,
        searchGroups,
        handleNavigate, clearSearch,
    }
}
