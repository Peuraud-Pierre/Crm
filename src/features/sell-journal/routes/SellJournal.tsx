import { BilanTab } from "@/features/sell-journal/components/BilanTab"
import { EntriesTab } from "@/features/sell-journal/components/EntriesTab"
import { StatsTab } from "@/features/sell-journal/components/StatsTab"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/atoms/tabs"
import { useSellJournalContext } from "@/features/sell-journal/context/SellJournalContext"
import { BarChart, Calendar1Icon, CalendarIcon } from "lucide-react"
import { useEffect } from "react"

const tabs = [
    {
        id: "today-entry",
        label: "Aujourd'hui",
        icon: Calendar1Icon,
        component: EntriesTab,
    },
    {
        id: "bilan",
        label: "Bilans",
        icon: CalendarIcon,
        component: BilanTab,
    },
    {
        id: "stats",
        label: "Statistiques",
        icon: BarChart,
        component: StatsTab,
    },
]

export function SellJournal() {
    const { activeTabJSell, setActiveTabJSell } = useSellJournalContext()

    useEffect(() => {
        localStorage.setItem("activeTabJSell", activeTabJSell)
    }, [activeTabJSell])

    return (
        <div className="min-h-0 bg-background">
            <div className="min-h-0 p-6">
                <Tabs value={activeTabJSell} onValueChange={setActiveTabJSell}>
                    <TabsList indicator indicatorClassName="rounded-md" className="grid grid-cols-3 w-full mb-6 bg-card shadow-sm h-full">
                        {tabs.map((tab) => (
                            <TabsTrigger
                                key={tab.id}
                                value={tab.id}
                                className="flex flex-col gap-1 py-3"
                            >
                                <tab.icon className="h-4 w-4" />
                                <span className="text-xs hidden sm:inline">
                                    {tab.label}
                                </span>
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    {tabs.map((tab) => (
                        <TabsContent key={tab.id} value={tab.id}>
                            {tab.component && <tab.component />}
                        </TabsContent>
                    ))}
                </Tabs>
            </div>
        </div>
    )
}
