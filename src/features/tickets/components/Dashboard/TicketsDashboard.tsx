import { useTicketContext } from "../../context/TicketContext"
import { KpiSection } from "./KpiSection"
import { StatusPieChart } from "./StatusPieChart"
import { PriorityBarChart } from "./PriorityBarChart"
import { RecentTicketsByType } from "./RecentTicketsByType"

export function TicketsDashboard() {
    const { tickets } = useTicketContext()

    return (
        <div className="space-y-4 sm:space-y-6">
            <KpiSection tickets={tickets} />
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <StatusPieChart tickets={tickets} />
                <PriorityBarChart tickets={tickets} />
            </div>
            <RecentTicketsByType tickets={tickets} />
        </div>
    )
}
