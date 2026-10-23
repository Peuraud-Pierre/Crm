import { useCRMContext } from "@/features/crm/context/CRMContext"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { cn } from "@/shared/lib/utils"
import { Tabs, TabsContent } from "@/shared/ui/atoms/tabs"
import {
    ManagerAvailability,
    CompanyAvailability,
} from "@/features/calendar-integrations/amelia"

// Permission requise pour gérer la dispo des autres. Même source de vérité que
// le bridge (helper SQL user_has_permission) → pas de décalage front/back.
const MANAGE_AVAILABILITY_PERMISSION = "availability.manage"

import { CalendarProvider } from "./context/CalendarContext"
import { CalendarHeader, CalendarSubTabs } from "./components/Calendar/Header"
import { CalendarFilterBar } from "./components/Calendar/Filter"
import { CalendarGrid } from "./components/Calendar/CalendarGrid"
import { CalendarSidebar } from "./components/Calendar/sidebar_event"
import { EventDetailsModal } from "./modales/EventDatailsModal"
import CreateEvent from "./components/Calendar/create_event"

function CalendarContent({ isManager }: { isManager: boolean }) {
    const { creationEvent, Update } = useCRMContext()

    return (
        <div className="h-full w-full bg-background rounded-2xl border border-border/40 shadow-sm overflow-hidden font-sans relative">
            {/* WRAPPER DU CONTENU : C'est lui qui prend le flou physique */}
            <div
                className={cn(
                    "flex flex-col md:flex-row w-full h-full transition-[filter,opacity] duration-slow",
                    creationEvent &&
                        "blur-md pointer-events-none opacity-60 bg-background/50"
                )}
            >
                {/* CONTENEUR GAUCHE : Calendrier */}
                <div className="@container flex-1 flex flex-col h-full overflow-hidden relative">
                    <CalendarHeader isManager={isManager} />
                    <CalendarFilterBar />
                    <CalendarGrid />
                </div>

                {/* CONTENEUR DROIT : SIDEBAR */}
                <CalendarSidebar />
                <EventDetailsModal />
            </div>

            {/* MODAL DE CREATION GLOBALE */}
            {creationEvent && (
                // z-50 : plafond de la feature. Au-delà, le panneau passerait
                // devant la sidebar applicative (drawer z-50 de MainLayout) —
                // c'est `absolute`, donc borné à la carte du calendrier de
                // toute façon, et CreateEvent monte un Dialog portalisé.
                <div className="absolute inset-0 z-50 flex items-center justify-center animate-in fade-in zoom-in-95 duration-base">
                    <CreateEvent update={Update} />
                </div>
            )}
        </div>
    )
}

export default function CalendarTab() {
    const { hasPermission } = useAuth()
    const isManager = hasPermission(MANAGE_AVAILABILITY_PERMISSION)

    return (
        <Tabs
            defaultValue="agenda"
            className="w-full h-full flex flex-col min-h-0"
        >
            <TabsContent
                value="agenda"
                className="mt-0 flex-1 min-h-0 flex flex-col"
            >
                <CalendarProvider>
                    <CalendarContent isManager={isManager} />
                </CalendarProvider>
            </TabsContent>

            {isManager && (
                <TabsContent
                    value="manager-dispo"
                    className="mt-0 flex-1 min-h-0"
                >
                    <div className="h-full overflow-y-auto rounded-2xl border border-border/40 bg-background shadow-sm p-4 sm:p-6 flex flex-col gap-4">
                        <CalendarSubTabs
                            isManager={isManager}
                            collapseLabels={false}
                        />
                        <ManagerAvailability />
                    </div>
                </TabsContent>
            )}

            {isManager && (
                <TabsContent
                    value="company-dispo"
                    className="mt-0 flex-1 min-h-0"
                >
                    <div className="h-full overflow-y-auto rounded-2xl border border-border/40 bg-background shadow-sm p-4 sm:p-6 flex flex-col gap-4">
                        <CalendarSubTabs
                            isManager={isManager}
                            collapseLabels={false}
                        />
                        <CompanyAvailability />
                    </div>
                </TabsContent>
            )}
        </Tabs>
    )
}
