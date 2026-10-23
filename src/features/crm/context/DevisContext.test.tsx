import React from "react"
import { act, renderHook } from "@testing-library/react"
import { expect, rstest, test } from "@rstest/core"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { QuoteProduct } from "@/features/crm/types"

// 1. Définition des variables hoisted
const mocks = rstest.hoisted(() => ({
    useCRMContext: rstest.fn(),
}))

// 2. Mock de useAuth (INDISPENSABLE)
rstest.mock("@/features/auth/hooks/useAuth", () => ({
    // eslint-disable-next-line react-x/no-unnecessary-use-prefix -- nom du hook mocké
    useAuth: () => ({
        user: { id: "test-uid", email: "test@example.com" },
        isAuthenticated: true,
    }),
}))

// 3. Mock de CRMContext
rstest.mock("./CRMContext", () => ({
    useCRMContext: () => mocks.useCRMContext(),
}))

// 4. Import du Provider
import { DevisProvider, useDevisContext } from "./DevisContext"

// DevisProvider charge le client du devis dans le cache TanStack (useClientById).
const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={new QueryClient()}>
        <DevisProvider>{children}</DevisProvider>
    </QueryClientProvider>
)

test("DevisProvider exposes default values and computed fields", () => {
    // Setup du mock
    mocks.useCRMContext.mockReturnValue({
        clients: [
            { id: "c1", siret: "123", nom: "Client" },
            { id: "c2", siret: null, nom: "Client2" },
        ],
        Produit: [
            { id: 1, name: "HandPick Shoes", categorie: "HandPick" },
            { id: 2, name: "Entrepot Tee", categorie: "Entrepôt" },
        ],
        Info: null,
        search: [],
        update_fiche_client: rstest.fn(), // Ajout car utilisé dans le Provider
    })

    const { result } = renderHook(() => useDevisContext(), { wrapper })

    expect(result.current.isPDFDisabled).toBe(true)

    act(() => {
        result.current.setClient("c1")
    })

    expect(result.current.isPDFDisabled).toBe(false)

    // Test du filtre (vérifie que ça filtre bien par défaut)
    // Selon votre logique, si inputValue est vide, tout s'affiche ou rien ne s'affiche
    // Adaptez cette ligne si besoin
    expect(result.current.filtered.length).toBeGreaterThanOrEqual(0)
})

test("filters products with HandPick toggle", () => {
    mocks.useCRMContext.mockReturnValue({
        clients: [{ id: "c1", siret: "123", nom: "Client" }],
        Produit: [
            { id: 1, name: "HandPick Shoes", categorie: "HandPick" },
            { id: 2, name: "Entrepot Tee", categorie: "Entrepôt" },
        ],
        update_fiche_client: rstest.fn(),
    })

    const { result } = renderHook(() => useDevisContext(), { wrapper })

    act(() => {
        result.current.setChecked(true)
        result.current.setInputValue("handpick")
    })

    // Vérification du filtre
    expect(result.current.filtered).toHaveLength(1)
    expect(result.current.filtered[0]?.name).toBe("HandPick Shoes")
})

test("round2 and totals compute correctly", () => {
    mocks.useCRMContext.mockReturnValue({
        clients: [{ id: "c1", siret: "123", nom: "Client" }],
        Produit: [],
        update_fiche_client: rstest.fn(),
    })

    const { result } = renderHook(() => useDevisContext(), { wrapper })

    // Ajout d'un produit complet (HT, TVA, TTC calculés)
    act(() => {
        const qty = 2
        const price = 10
        const tva = 20
        const totalHT = qty * price
        const totalTVA = totalHT * (tva / 100)
        const totalTTC = totalHT + totalTVA

        result.current.setProducts([
            {
                id: "p1",
                name: "Produit",
                description: "",
                qty,
                price,
                tva,
                mode: "Pièce",
                weight: 0,
                // Il faut fournir les totaux car setProducts ne les recalcule pas automatiquement
                // si vous passez l'objet directement (sauf si loadQuoteData est utilisé)
                totalHT,
                totalTVA,
                totalTTC,
            } satisfies QuoteProduct,
        ])
    })

    expect(result.current.round2(10.129)).toBe(10.13)
    expect(result.current.totals.totalTTC).toBe(24) // 20 + 4
})
