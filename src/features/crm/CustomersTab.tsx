import { useMemo } from "react"
import { TooltipProvider } from "@/shared/ui/atoms/tooltip"
import { useCRMContext } from "@/features/crm/context/CRMContext"
import { CustomersProvider, useCustomers } from "./context/CustomerContext"
import { CustomersBoard } from "./components/CustomerTabSplit/CustomerBoard"
import Createclient from "./components/Client/creation_client"
import { FilterBar } from "./components/CustomerTabSplit/FilterBar"
import { ClientsTableView } from "./components/CustomerTabSplit/TableView"
import { AddEventModal } from "./components/Client/Fiche_split/creation_event"
import { resolveSingletonEventClient } from "./utils/eventModal"

function CustomersContent() {
    const {
        viewMode,
        visibleColumns,
        filteredClients,
        clientTaskMap,
        handleClientClick,
    } = useCustomers()

    const {
        creationclient,
        setCreationclient,
        selectedClient,
        // Singleton de la modale "Nouvelle interaction" : un seul mount
        // pour tout l'onglet, ouvert pour le client dont l'id est dans
        // `openEventModal`. Évite d'instancier 868 lignes × N cards.
        clients,
        openEventModal,
        setOpenEventModal,
        // Quand la fiche client est ouverte pour ce même client, elle rend déjà
        // sa propre modale → on évite le doublon ici.
        FicheClient,
        customer,
    } = useCRMContext()

    const eventModalClient = useMemo(
        () =>
            resolveSingletonEventClient(
                openEventModal,
                clients,
                FicheClient,
                customer?.id
            ),
        [openEventModal, clients, FicheClient, customer?.id]
    )

    return (
        <div className="space-y-4 h-full flex flex-col">
            <FilterBar />

            <TooltipProvider delayDuration={100}>
                {viewMode === "board" ? (
                    <CustomersBoard />
                ) : (
                    <div className="rounded-md border bg-card h-[calc(100vh-220px)] overflow-auto animate-in fade-in">
                        <ClientsTableView
                            clients={filteredClients}
                            clientTaskMap={clientTaskMap}
                            onClientClick={handleClientClick}
                            visibleColumns={visibleColumns}
                        />
                    </div>
                )}
            </TooltipProvider>

            {creationclient && (
                <Createclient
                    setCreationclient={setCreationclient}
                    client={selectedClient}
                />
            )}

            {eventModalClient && (
                <AddEventModal
                    client={eventModalClient}
                    open={true}
                    onOpenChange={(o) => {
                        if (!o) setOpenEventModal(null)
                    }}
                />
            )}
        </div>
    )
}

export default function CustomersTab() {
    return (
        <CustomersProvider>
            <CustomersContent />
        </CustomersProvider>
    )
}
