import { beforeEach, expect, rstest, test } from "@rstest/core"
import { act, renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"

const mocks = rstest.hoisted(() => ({
    clients: [] as unknown[],
    AllTache: [] as unknown[],
    fetch_research: rstest.fn(),
    fetchClientCounts: rstest.fn(),
    setUsersee: rstest.fn(),
    setClientToOpen: rstest.fn(),
    setCreationclient: rstest.fn(),
    setSelectedClient: rstest.fn(),
    user: { user_id: "user-1", service: "Sales" },
}))

rstest.mock("@/features/crm/context/CRMContext", () => ({
    // eslint-disable-next-line react-x/no-unnecessary-use-prefix -- nom du hook mocké
    useCRMContext: () => ({
        clients: mocks.clients,
        AllTache: mocks.AllTache,
        fetch_research: mocks.fetch_research,
        fetchClientCounts: mocks.fetchClientCounts,
        setUsersee: mocks.setUsersee,
        setClientToOpen: mocks.setClientToOpen,
        setCreationclient: mocks.setCreationclient,
        setSelectedClient: mocks.setSelectedClient,
    }),
}))

rstest.mock("@/features/auth/hooks/useAuth", () => ({
    // eslint-disable-next-line react-x/no-unnecessary-use-prefix -- nom du hook mocké
    useAuth: () => ({ user: mocks.user }),
}))

rstest.mock("sonner", () => ({
    toast: { error: rstest.fn(), success: rstest.fn() },
}))

import { CustomersProvider, useCustomers } from "./CustomerContext"

// Les listes clients sont des requêtes TanStack (aucune ne part ici : vue
// Kanban sans colonne montée, pas de recherche) : un client neuf par rendu.
const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={new QueryClient()}>
        <CustomersProvider>{children}</CustomersProvider>
    </QueryClientProvider>
)
const renderCustomers = () => renderHook(() => useCustomers(), { wrapper })

beforeEach(() => {
    rstest.clearAllMocks()
})

test("au mount : commerciaux + compteurs du périmètre 'Mes clients'", async () => {
    const { result } = renderCustomers()

    await waitFor(() => {
        expect(mocks.fetch_research).toHaveBeenCalled()
        expect(mocks.fetchClientCounts).toHaveBeenCalledWith("user-1")
    })
    // filtre par défaut = "none" => listes du commercial courant
    expect(result.current.scope).toBe("user-1")
})

test("sélection 'Tous' : périmètre null (cœur du bug) et compteurs rechargés", async () => {
    const { result } = renderCustomers()
    await waitFor(() => {
        expect(mocks.fetchClientCounts).toHaveBeenCalledWith("user-1")
    })
    mocks.fetchClientCounts.mockClear()

    act(() => {
        result.current.updateFilter("user", "all")
    })

    await waitFor(() => {
        expect(result.current.scope).toBeNull()
        expect(mocks.fetchClientCounts).toHaveBeenCalledWith(undefined)
    })
})

test("sélection d'un commercial précis : périmètre = son id", async () => {
    const { result } = renderCustomers()

    act(() => {
        result.current.updateFilter("user", "user-2")
    })

    await waitFor(() => {
        expect(result.current.scope).toBe("user-2")
        expect(mocks.fetchClientCounts).toHaveBeenCalledWith("user-2")
    })
})

test("retour à 'Mes clients' : périmètre = utilisateur courant", async () => {
    const { result } = renderCustomers()

    act(() => {
        result.current.updateFilter("user", "all")
    })
    await waitFor(() => {
        expect(result.current.scope).toBeNull()
    })

    act(() => {
        result.current.updateFilter("user", "none")
    })
    await waitFor(() => {
        expect(result.current.scope).toBe("user-1")
    })
})

test("hasActiveFilters: faux pour 'Tous', vrai pour un commercial précis", async () => {
    const { result } = renderCustomers()

    // défaut "none" => pas de filtre actif
    expect(result.current.hasActiveFilters).toBe(false)

    act(() => {
        result.current.updateFilter("user", "all")
    })
    await waitFor(() => {
        expect(result.current.filters.user).toBe("all")
    })
    // "Tous" est un état neutre => pas de bouton reset
    expect(result.current.hasActiveFilters).toBe(false)

    act(() => {
        result.current.updateFilter("user", "user-2")
    })
    await waitFor(() => {
        expect(result.current.filters.user).toBe("user-2")
    })
    expect(result.current.hasActiveFilters).toBe(true)
})
