import { OpenTicketTab } from "@/features/tickets/components/OpenTicketTab"
import { TicketsDashboard } from "@/features/tickets/components/Dashboard/TicketsDashboard"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/ui/atoms/tabs"
import { BarChart3, KanbanSquare } from "lucide-react"

export default function Tickets() {
    return (
        <div className="min-h-0 bg-background">
            <Tabs defaultValue="tickets" className="w-full">
                <div className="px-6 pt-4">
                    <TabsList indicator>
                        <TabsTrigger value="tickets" className="gap-2">
                            <KanbanSquare className="h-4 w-4" />
                            Tickets
                        </TabsTrigger>
                        <TabsTrigger value="dashboard" className="gap-2">
                            <BarChart3 className="h-4 w-4" />
                            Indicateurs
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="tickets" className="mt-0">
                    <div className="min-h-0 p-2 sm:p-6 pt-2">
                        <OpenTicketTab />
                    </div>
                </TabsContent>

                <TabsContent value="dashboard" className="mt-0">
                    <div className="min-h-0 p-3 sm:p-6 pt-2">
                        <TicketsDashboard />
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}
