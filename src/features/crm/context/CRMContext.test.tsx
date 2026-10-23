import { act, renderHook } from "@testing-library/react"
import { beforeEach, expect, rstest, test } from "@rstest/core"

import type { Client } from "@/features/crm/hooks/CRM_hook/use_client"
import type { Event_creation } from "@/features/crm/hooks/CRM_hook/use_calendar"

const mocks = rstest.hoisted(() => ({
    events: [] as Event_creation[],
    create_event_calendar: rstest.fn(),
    fetch_calendar_event: rstest.fn(),
    deleteEvent: rstest.fn(),
    update_Event: rstest.fn(),
    Produit: [],
    create_product: rstest.fn(),
    fetch_products: rstest.fn(),
    delete_product: rstest.fn(),
    update_product: rstest.fn(),
    refreshProducts: rstest.fn(),
    activites: [],
    create_activites: rstest.fn(),
    fetch_activite: rstest.fn(),
    update_Activites: rstest.fn(),
    delete_activites: rstest.fn(),
    clients: [],
    search: [],
    fetch_research: rstest.fn(),
    create_fiche_client: rstest.fn(),
    fetch_client: rstest.fn(),
    update_fiche_client: rstest.fn(),
    delete_fiche_client: rstest.fn(),
    take_lead: rstest.fn(),
    Tache: [],
    TacheDelegated: [],
    AllTache: [],
    clientTaches: [],
    create_Tache: rstest.fn(),
    fetch_Tache: rstest.fn(),
    fetch_Tache_delegated: rstest.fn(),
    update_Tache: rstest.fn(),
    delete_Tache: rstest.fn(),
    fetch_Tache_alltask: rstest.fn(),
    fetch_client_taches: rstest.fn(),
    Devis: [],
    Register_devis: rstest.fn(),
    fetchDevisByUser: rstest.fn(),
    Update_devis: rstest.fn(),
    DeleteDevis: rstest.fn(),
}))

rstest.mock("@/features/crm/hooks/CRM_hook/use_calendar", () => ({
    // eslint-disable-next-line react-x/no-unnecessary-use-prefix -- nom du hook mocké
    useEvent: () => ({
        events: mocks.events,
        create_event_calendar: mocks.create_event_calendar,
        fetch_calendar_event: mocks.fetch_calendar_event,
        deleteEvent: mocks.deleteEvent,
        update_Event: mocks.update_Event,
    }),
}))

rstest.mock("@/features/crm/hooks/CRM_hook/use_product", () => ({
    // eslint-disable-next-line react-x/no-unnecessary-use-prefix -- nom du hook mocké
    useProduct: () => ({
        Produit: mocks.Produit,
        create_product: mocks.create_product,
        fetch_products: mocks.fetch_products,
        delete_product: mocks.delete_product,
        update_product: mocks.update_product,
        refreshProducts: mocks.refreshProducts,
    }),
}))

rstest.mock("@/features/crm/hooks/CRM_hook/use_activites", () => ({
    // eslint-disable-next-line react-x/no-unnecessary-use-prefix -- nom du hook mocké
    useActivites: () => ({
        activites: mocks.activites,
        create_activites: mocks.create_activites,
        fetch_activite: mocks.fetch_activite,
        update_Activites: mocks.update_Activites,
        delete_activites: mocks.delete_activites,
    }),
}))

rstest.mock("@/features/crm/hooks/CRM_hook/use_client", () => ({
    // eslint-disable-next-line react-x/no-unnecessary-use-prefix -- nom du hook mocké
    useClient: () => ({
        clients: mocks.clients,
        search: mocks.search,
        fetch_research: mocks.fetch_research,
        create_fiche_client: mocks.create_fiche_client,
        fetch_client: mocks.fetch_client,
        update_fiche_client: mocks.update_fiche_client,
        delete_fiche_client: mocks.delete_fiche_client,
        take_lead: mocks.take_lead,
    }),
}))

rstest.mock("@/features/crm/hooks/CRM_hook/use_tache", () => ({
    // eslint-disable-next-line react-x/no-unnecessary-use-prefix -- nom du hook mocké
    useTache: () => ({
        Tache: mocks.Tache,
        AllTache: mocks.AllTache,
        clientTaches: mocks.clientTaches,
        create_Tache: mocks.create_Tache,
        fetch_Tache: mocks.fetch_Tache,
        update_Tache: mocks.update_Tache,
        delete_Tache: mocks.delete_Tache,
        fetch_Tache_alltask: mocks.fetch_Tache_alltask,
        fetch_client_taches: mocks.fetch_client_taches,
    }),
}))

rstest.mock("@/features/crm/hooks/CRM_hook/use_devis", () => ({
    // eslint-disable-next-line react-x/no-unnecessary-use-prefix -- nom du hook mocké
    useDevis: () => ({
        Devis: mocks.Devis,
        Register_devis: mocks.Register_devis,
        fetchDevisByUser: mocks.fetchDevisByUser,
        Update_devis: mocks.Update_devis,
        DeleteDevis: mocks.DeleteDevis,
    }),
}))

import { CRMProvider, useCRMContext } from "./CRMContext"

beforeEach(() => {
    rstest.clearAllMocks()
    mocks.events = []
    localStorage.setItem("activeTab", "calendar")
    localStorage.setItem("combinedFilter", "all")
})

test("initializes from localStorage and exposes base values", () => {
    localStorage.setItem("activeTab", "clients")
    localStorage.setItem("combinedFilter", "pending")

    const { result } = renderHook(() => useCRMContext(), {
        wrapper: CRMProvider,
    })

    expect(result.current.activeTab).toBe("clients")
    expect(result.current.combinedFilter).toBe("pending")
    expect(result.current.combinedRef.current).toBe("pending")
    expect(result.current.timeZone).toBe("UTC")
    expect(result.current.HOUR_HEIGHT).toBe(64)
    expect(result.current.DAY_HEIGHT).toBe(64 * 24)
})

test("openClientFiche sets customer and opens the fiche", () => {
    const { result } = renderHook(() => useCRMContext(), {
        wrapper: CRMProvider,
    })

    const client: Client = {
        id: "client-1",
        nom: "Client",
        societe: null,
        telephone: null,
        mail: null,
        siret: null,
        localisation: null,
    }

    act(() => {
        result.current.openClientFiche(client)
    })

    expect(result.current.customer).toEqual(client)
    expect(result.current.FicheClient).toBe(true)
})

test("eventsForCurrentDay matches events on the current day", () => {
    const now = new Date()
    const later = new Date(now.getTime() + 60 * 60 * 1000)
    const future = new Date(now.getTime() + 48 * 60 * 60 * 1000)

    mocks.events = [
        {
            id: "evt-1",
            debut: now,
            fin: later,
            participants: null,
            lieu: null,
            description: null,
        },
        {
            id: "evt-2",
            debut: future,
            fin: future,
            participants: null,
            lieu: null,
            description: null,
        },
    ]

    const { result } = renderHook(() => useCRMContext(), {
        wrapper: CRMProvider,
    })

    expect(result.current.eventsForCurrentDay).toHaveLength(1)
    expect(result.current.eventsForCurrentDay[0]?.id).toBe("evt-1")
})
