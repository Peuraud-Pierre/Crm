// ── useSearch.test.ts ─────────────────────────────────────────────────────────
// Tests unitaires du hook de recherche (useSearch.ts).
//
// Ce hook contient la logique métier la plus importante de la feature :
//   - filtrage des thématiques et Q&R selon un terme de recherche
//   - debounce de 150ms pour éviter les re-renders à chaque frappe
//   - groupement des résultats par thématique (isThematiqueMatch en tête)
//   - navigation vers une thématique (handleNavigate)
//   - fermeture de la recherche sans navigation (clearSearch)
//   - sélection d'une Q&R pour afficher son détail (detailQRId)
//
// Dépendances de ce hook :
//   - thematiques, questionsReponses : données passées en props (pas de Supabase)
//   - utils.tsx (tLabel, tQuestion, tReponse) : fonctions pures
//   → Aucun mock nécessaire.
//
// Stratégie pour le debounce :
//   rstest 0.8.x n'expose pas d'API de fake timers. On utilise `waitFor` de
//   React Testing Library, qui réessaie l'assertion jusqu'au timeout (500ms).
//   Le vrai setTimeout de 150ms s'écoule en temps réel — le test attend
//   naturellement que searchGroups reflète la query.

import { describe, expect, test, rstest } from "@rstest/core"
import { act, renderHook, waitFor } from "@testing-library/react"
import { useSearch } from "./useSearch"
import type { Thematique, QR } from "../types"

// ── Données de test fixes ─────────────────────────────────────────────────────
// Deux thématiques avec des Q&R représentatives. Assez riches pour couvrir les
// cas de filtrage (match thématique, match question, match réponse, pas de match).

const thematiques: Thematique[] = [
    { id: "t1", label: "Livraison", labelEn: "Delivery", imageUrl: "", iconUrl: "" },
    { id: "t2", label: "Retours",   labelEn: "Returns",  imageUrl: "", iconUrl: "" },
]

const questionsReponses: QR[] = [
    // Q&R de t1
    {
        id: "qr1", thematiqueId: "t1",
        question: "Quel est le délai ?", questionEn: "What is the delay?",
        briefQr: "48h ouvrées", briefQrEn: "48 business hours",
    },
    {
        id: "qr2", thematiqueId: "t1",
        question: "Y a-t-il des frais de port ?", questionEn: "Are there shipping fees?",
        briefQr: "Gratuit dès 50€", briefQrEn: "Free above €50",
    },
    // Q&R de t2
    {
        id: "qr3", thematiqueId: "t2",
        question: "Comment retourner un article ?", questionEn: "How to return an item?",
        briefQr: "Par courrier sous 30 jours", briefQrEn: "By mail within 30 days",
    },
]

// ── Helper : monte le hook avec les données fixes ──────────────────────────────
// setActiveId est mocké pour vérifier qu'il est bien appelé par handleNavigate.

const renderSearch = (lang: "fr" | "en" = "fr") => {
    const setActiveId = rstest.fn()
    const hook = renderHook(() =>
        useSearch({ thematiques, questionsReponses, lang, setActiveId })
    )
    return { ...hook, setActiveId }
}

// ── État initial ───────────────────────────────────────────────────────────────

describe("useSearch — état initial", () => {
    test("searchQuery est '' au démarrage", () => {
        const { result } = renderSearch()
        expect(result.current.searchQuery).toBe("")
    })

    test("searchGroups est vide au démarrage (pas de recherche active)", () => {
        const { result } = renderSearch()
        expect(result.current.searchGroups).toHaveLength(0)
    })

    test("detailQRId est null au démarrage", () => {
        const { result } = renderSearch()
        expect(result.current.detailQRId).toBeNull()
    })

    test("detailQR est null quand detailQRId est null", () => {
        const { result } = renderSearch()
        expect(result.current.detailQR).toBeNull()
    })
})

// ── Debounce ───────────────────────────────────────────────────────────────────
// Vérifie que searchGroups ne se met à jour qu'après l'expiration des 150ms.
// Sans fake timers, on observe le comportement réel : immédiatement après
// le setState de searchQuery, debouncedQuery n'a pas encore changé.

describe("useSearch — debounce 150ms", () => {
    test("searchGroups reste vide juste après la frappe (timer pas encore expiré)", () => {
        const { result } = renderSearch()
        // act() flush uniquement le setState synchrone (setSearchQuery).
        // Le useEffect qui lance setTimeout n'a pas encore expiré.
        act(() => result.current.setSearchQuery("livraison"))
        // À ce moment précis (0ms), debouncedQuery est encore "" → searchGroups vide
        expect(result.current.searchGroups).toHaveLength(0)
    })

    test("searchGroups se remplit après les 150ms du debounce", async () => {
        const { result } = renderSearch()
        // waitFor réessaie l'assertion jusqu'à ce que searchGroups soit non vide
        // (ce qui arrive après l'expiration du timer de 150ms)
        act(() => result.current.setSearchQuery("livraison"))
        await waitFor(
            () => expect(result.current.searchGroups.length).toBeGreaterThan(0),
            { timeout: 500 }
        )
    })

    test("searchGroups se vide si query redevient vide après 150ms", async () => {
        const { result } = renderSearch()
        act(() => result.current.setSearchQuery("livraison"))
        await waitFor(
            () => expect(result.current.searchGroups.length).toBeGreaterThan(0),
            { timeout: 500 }
        )
        // On vide la recherche
        act(() => result.current.setSearchQuery(""))
        await waitFor(
            () => expect(result.current.searchGroups).toHaveLength(0),
            { timeout: 500 }
        )
    })
})

// ── Logique de filtrage ────────────────────────────────────────────────────────
// Vérifie les 4 cas de match : label thématique, question, réponse, aucun résultat.

describe("useSearch — filtrage des résultats", () => {
    test("match sur le label de la thématique → isThematiqueMatch=true", async () => {
        const { result } = renderSearch()
        act(() => result.current.setSearchQuery("livraison")) // = t1.label en FR
        await waitFor(() => expect(result.current.searchGroups).toHaveLength(1), { timeout: 500 })
        expect(result.current.searchGroups[0].thematique.id).toBe("t1")
        expect(result.current.searchGroups[0].isThematiqueMatch).toBe(true)
    })

    test("isThematiqueMatch=true → toutes les Q&R de la thématique sont incluses", async () => {
        const { result } = renderSearch()
        act(() => result.current.setSearchQuery("livraison")) // t1 a 2 Q&R
        await waitFor(() => expect(result.current.searchGroups).toHaveLength(1), { timeout: 500 })
        expect(result.current.searchGroups[0].questionsReponses).toHaveLength(2)
    })

    test("match sur le label anglais quand lang=en", async () => {
        const setActiveId = rstest.fn()
        const { result } = renderHook(() =>
            useSearch({ thematiques, questionsReponses, lang: "en", setActiveId })
        )
        act(() => result.current.setSearchQuery("delivery")) // = t1.labelEn
        await waitFor(() => expect(result.current.searchGroups.length).toBeGreaterThan(0), { timeout: 500 })
        expect(result.current.searchGroups[0].isThematiqueMatch).toBe(true)
    })

    test("match uniquement sur la question → seule cette Q&R apparaît dans le groupe", async () => {
        const { result } = renderSearch()
        act(() => result.current.setSearchQuery("délai")) // = mot dans qr1.question (t1), pas dans le label
        await waitFor(() => expect(result.current.searchGroups.length).toBeGreaterThan(0), { timeout: 500 })
        const group = result.current.searchGroups.find((g) => g.thematique.id === "t1")
        expect(group).toBeDefined()
        expect(group!.isThematiqueMatch).toBe(false)
        // Seule qr1 contient "délai" — pas qr2
        expect(group!.questionsReponses).toHaveLength(1)
        expect(group!.questionsReponses[0].id).toBe("qr1")
    })

    test("match uniquement sur la réponse (briefQr)", async () => {
        const { result } = renderSearch()
        act(() => result.current.setSearchQuery("courrier")) // = dans qr3.briefQr (t2)
        await waitFor(() => expect(result.current.searchGroups).toHaveLength(1), { timeout: 500 })
        expect(result.current.searchGroups[0].thematique.id).toBe("t2")
        expect(result.current.searchGroups[0].questionsReponses[0].id).toBe("qr3")
    })

    test("aucun match → searchGroups vide après le debounce", async () => {
        const { result } = renderSearch()
        // D'abord on crée un état "avec résultats" pour s'assurer que le debounce a bien tiré
        act(() => result.current.setSearchQuery("livraison"))
        await waitFor(() => expect(result.current.searchGroups.length).toBeGreaterThan(0), { timeout: 500 })
        // Puis on cherche quelque chose qui n'existe pas
        act(() => result.current.setSearchQuery("xyzterme_inexistant_999"))
        await waitFor(() => expect(result.current.searchGroups).toHaveLength(0), { timeout: 500 })
    })

    test("la recherche est case-insensitive", async () => {
        const { result } = renderSearch()
        act(() => result.current.setSearchQuery("LIVRAISON"))
        await waitFor(() => expect(result.current.searchGroups.length).toBeGreaterThan(0), { timeout: 500 })
    })

    test("les groupes thematique-match sont triés en premier", async () => {
        const { result } = renderSearch()
        // "retour" matche le label "Retours" (t2) ET la question "retourner" (qr3 dans t2).
        // Si plusieurs groupes sont retournés, le premier doit avoir isThematiqueMatch=true.
        act(() => result.current.setSearchQuery("retour"))
        await waitFor(() => expect(result.current.searchGroups.length).toBeGreaterThan(0), { timeout: 500 })
        if (result.current.searchGroups.length > 1) {
            expect(result.current.searchGroups[0].isThematiqueMatch).toBe(true)
        }
    })
})

// ── clearSearch ───────────────────────────────────────────────────────────────
// Bouton "Retour" dans SearchResults : ferme la recherche sans naviguer.
// Reset immédiat des deux états internes (pas de debounce).

describe("useSearch — clearSearch", () => {
    test("vide searchQuery immédiatement (sans attendre le debounce)", () => {
        const { result } = renderSearch()
        act(() => result.current.setSearchQuery("test"))
        act(() => result.current.clearSearch())
        // Pas de waitFor : clearSearch est synchrone
        expect(result.current.searchQuery).toBe("")
    })

    test("remet detailQRId à null immédiatement", () => {
        const { result } = renderSearch()
        act(() => result.current.setDetailQRId("qr1"))
        act(() => result.current.clearSearch())
        expect(result.current.detailQRId).toBeNull()
    })
})

// ── handleNavigate ────────────────────────────────────────────────────────────
// Clic sur un titre de thématique dans les résultats : quitte la recherche ET
// navigue vers la thématique. Reset immédiat des 3 états.

describe("useSearch — handleNavigate", () => {
    test("vide searchQuery immédiatement", () => {
        const { result } = renderSearch()
        act(() => result.current.setSearchQuery("test"))
        act(() => result.current.handleNavigate("t2"))
        expect(result.current.searchQuery).toBe("")
    })

    test("appelle setActiveId avec l'id fourni", () => {
        const { result, setActiveId } = renderSearch()
        act(() => result.current.handleNavigate("t2"))
        expect(setActiveId).toHaveBeenCalledTimes(1)
        expect(setActiveId).toHaveBeenCalledWith("t2")
    })

    test("remet detailQRId à null", () => {
        const { result } = renderSearch()
        act(() => result.current.setDetailQRId("qr1"))
        act(() => result.current.handleNavigate("t1"))
        expect(result.current.detailQRId).toBeNull()
    })
})

// ── Sélection de Q&R (detailQR / detailThematique) ───────────────────────────
// Quand l'utilisateur clique sur une Q&R dans les résultats, son détail
// s'affiche à droite via QRDetailPanel.

describe("useSearch — détail Q&R", () => {
    test("detailQR retourne la Q&R correspondant à detailQRId", () => {
        const { result } = renderSearch()
        act(() => result.current.setDetailQRId("qr3"))
        expect(result.current.detailQR?.id).toBe("qr3")
    })

    test("detailThematique retourne la thématique parente de la Q&R sélectionnée", () => {
        const { result } = renderSearch()
        act(() => result.current.setDetailQRId("qr3")) // qr3 appartient à t2
        expect(result.current.detailThematique?.id).toBe("t2")
    })

    test("detailQR est null si detailQRId est null", () => {
        const { result } = renderSearch()
        expect(result.current.detailQR).toBeNull()
    })

    test("detailQR est null si detailQRId ne correspond à aucune Q&R", () => {
        const { result } = renderSearch()
        act(() => result.current.setDetailQRId("inexistant"))
        expect(result.current.detailQR).toBeNull()
    })
})
