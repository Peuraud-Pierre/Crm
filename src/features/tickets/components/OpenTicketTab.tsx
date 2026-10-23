import { TicketFilterBar } from "./TicketKanban/filter"
import { TicketPriorityKanban } from "./TicketKanban/KanbanBoard"

export function OpenTicketTab() {
    return (
        <div className="flex h-full w-full flex-col overflow-hidden">
            {/* 1. Barre de Filtres (Connectée au Context) */}
            <div className="shrink-0 z-10">
                <TicketFilterBar />
            </div>

            {/* 2. Zone du Kanban (Prend l'espace restant) */}
            <main className="flex-1 relative overflow-hidden">
                <TicketPriorityKanban />
            </main>
        </div>
    )
}
