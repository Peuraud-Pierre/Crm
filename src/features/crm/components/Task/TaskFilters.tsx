import { useRef } from "react"
import { Plus } from "lucide-react"
import { useTaskPage } from "../../context/TaskPageContext"
import { LiquidTabsIndicator } from "@/shared/ui/molecules/liquid-tabs-indicator"

export function TaskFilters() {
    const { filters, activeFilter, setActiveFilter, taskCount, handleOpenCreateModal } =
        useTaskPage()
    const filtersRef = useRef<HTMLDivElement>(null)

    return (
        <div className="flex flex-wrap items-center gap-3 mb-4">
            <button
                onClick={handleOpenCreateModal}
                className="px-4 py-2 rounded-lg font-medium transition-shadow duration-base flex items-center gap-2 text-sm bg-primary text-primary-foreground shadow-sm hover:shadow-md"
            >
                <Plus size={16} />
                Nouvelle tâche
            </button>

            <div
                ref={filtersRef}
                className="relative flex flex-nowrap items-center gap-1 p-1 rounded-lg bg-muted border border-border overflow-x-auto hide-scrollbar max-w-full"
            >
                {/* flex-nowrap + scroll plutôt que flex-wrap : LiquidTabsIndicator
                    ne translate qu'en X (pas de translateY par ligne) — si les
                    boutons passaient à la ligne sur mobile, la pastille active
                    resterait figée sur la position de la 1re rangée. */}
                <LiquidTabsIndicator
                    containerRef={filtersRef}
                    activeValue={activeFilter}
                    className="inset-y-1 rounded-md bg-primary border-none shadow-sm"
                />
                {filters.map((filter) => (
                    <button
                        key={filter.value}
                        data-state={
                            activeFilter === filter.value
                                ? "active"
                                : "inactive"
                        }
                        onClick={() => setActiveFilter(filter.value)}
                        className={`relative z-10 shrink-0 px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-2 text-sm ${
                            activeFilter === filter.value
                                ? "text-primary-foreground"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        {filter.label}
                        <span
                            className={`px-2 py-0.5 rounded-full text-xs ${
                                activeFilter === filter.value
                                    ? "bg-primary-foreground/20 text-primary-foreground"
                                    : "bg-background text-muted-foreground"
                            }`}
                        >
                            {taskCount(filter.value)}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    )
}
