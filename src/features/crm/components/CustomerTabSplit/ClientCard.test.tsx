import React from "react"
import { describe, expect, rstest, test } from "@rstest/core"
import { render, screen, fireEvent } from "@testing-library/react"

rstest.mock("@/features/crm/context/CRMContext", () => ({
    // eslint-disable-next-line react-x/no-unnecessary-use-prefix -- doit reproduire le nom du hook mocké
    useCRMContext: () => ({
        openEventModal: false,
        setOpenEventModal: rstest.fn(),
    }),
}))

// AddEventModal monte des dialogs Radix lourds — on stubs.
rstest.mock(
    "@/features/crm/components/Client/Fiche_split/creation_event",
    () => ({
        AddEventModal: () => null,
    })
)

import { ClientCard } from "./ClientCard"
import { TooltipProvider } from "@/shared/ui/atoms/tooltip"
import type { Client, FicheAppro } from "@/features/crm/hooks/CRM_hook/use_client"

const renderWithProviders = (ui: React.ReactElement) =>
    render(<TooltipProvider>{ui}</TooltipProvider>)

const makeClient = (overrides: Partial<Client> = {}): Client => ({
    id: "c1",
    nom: "Alice",
    societe: null,
    telephone: null,
    mail: null,
    siret: null,
    localisation: null,
    collum: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    customer: null,
    closers: null,
    prise_en_charge: "x",
    brief: { experience: "+ 3 ans", budget: 5000 } as FicheAppro,
    ...overrides,
})

describe("ClientCard", () => {
    test("affiche les champs principaux du brief", () => {
        renderWithProviders(
            <ClientCard
                client={makeClient()}
                taskStatus="green"
                isDragging={false}
                onDragStart={() => {}}
                onClick={() => {}}
            />
        )
        expect(screen.getByText("Alice")).toBeInTheDocument()
        expect(screen.getByText(/\+ 3 ans/)).toBeInTheDocument()
        expect(screen.getByText(/5000/)).toBeInTheDocument()
    })

    test("déclenche onClick avec le client", () => {
        const onClick = rstest.fn()
        renderWithProviders(
            <ClientCard
                client={makeClient()}
                taskStatus="none"
                isDragging={false}
                onDragStart={() => {}}
                onClick={onClick}
            />
        )
        fireEvent.click(screen.getByText("Alice"))
        expect(onClick).toHaveBeenCalledTimes(1)
        expect(onClick.mock.calls[0][0].id).toBe("c1")
    })

    test("masque les champs absents du brief", () => {
        renderWithProviders(
            <ClientCard
                client={makeClient({ brief: null })}
                taskStatus="notask"
                isDragging={false}
                onDragStart={() => {}}
                onClick={() => {}}
            />
        )
        expect(screen.queryByText(/Experience:/)).toBeNull()
        expect(screen.queryByText(/Budget:/)).toBeNull()
    })

    test("budget à 0 : ni ligne Budget ni « 0 » orphelin", () => {
        renderWithProviders(
            <ClientCard
                client={makeClient({
                    brief: { experience: "+ 3 ans", budget: 0 } as FicheAppro,
                })}
                taskStatus="none"
                isDragging={false}
                onDragStart={() => {}}
                onClick={() => {}}
            />
        )
        expect(screen.queryByText(/Budget:/)).toBeNull()
        expect(screen.queryByText("0")).toBeNull()
    })
})
