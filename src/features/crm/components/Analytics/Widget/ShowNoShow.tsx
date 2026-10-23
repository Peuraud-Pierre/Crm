import { motion } from "framer-motion"
import { useAnalytics } from "../../../context/AnalyticsContext"
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts"
import { Card } from "@/shared/ui/atoms/card"
import { RECHARTS_TOOLTIP_THEME } from "@/shared/lib/rechartsTooltip"
import { UserCheck } from "lucide-react"

export function WidgetShowNoShow() {
    const { showNoShowData } = useAnalytics()

    return (
        <motion.div
            key="w-show-no-show"
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
        >
            <Card className="p-4 sm:p-6 border-border/50 h-full min-h-[380px] flex flex-col">
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <h3 className="text-base sm:text-lg font-bold">
                            Taux de présence
                        </h3>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                            Sur un total de {showNoShowData.total} RDV
                        </p>
                    </div>
                    <div className="p-2 bg-emerald-500/10 rounded-lg shrink-0">
                        <UserCheck className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" />
                    </div>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center relative">
                    {showNoShowData.total > 0 ? (
                        <>
                            <ResponsiveContainer width="100%" height={200}>
                                <PieChart>
                                    <Pie
                                        data={showNoShowData.data}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {showNoShowData.data.map(
                                            (entry: { name?: string; color?: string; payload?: unknown }) => (
                                                <Cell
                                                    key={entry.name}
                                                    fill={entry.color}
                                                />
                                            )
                                        )}
                                    </Pie>
                                    <Tooltip
                                        {...RECHARTS_TOOLTIP_THEME}
                                        formatter={(value, name) => [
                                            `${Number(value)} RDV (${Math.round((Number(value) / showNoShowData.total) * 100)}%)`,
                                            String(name),
                                        ] as [string, string]}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="mt-0 flex gap-8 text-center justify-center w-full flex-wrap">
                                <div>
                                    <p className="text-3xl font-black text-emerald-500">
                                        {showNoShowData.showRate}%
                                    </p>
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground">
                                        Présents ({showNoShowData.shows})
                                    </p>
                                </div>
                                <div className="w-px bg-border/50"></div>
                                <div>
                                    <p className="text-3xl font-black text-red-500">
                                        {showNoShowData.noShowRate}%
                                    </p>
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground">
                                        Absents ({showNoShowData.noShows})
                                    </p>
                                </div>
                                {showNoShowData.pending > 0 && (
                                    <>
                                        <div className="w-px bg-border/50"></div>
                                        <div>
                                            <p className="text-3xl font-black text-muted-foreground">
                                                {showNoShowData.pending}
                                            </p>
                                            <p className="text-[10px] uppercase font-bold text-muted-foreground">
                                                Non renseigné
                                            </p>
                                        </div>
                                    </>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground text-sm italic">
                            Aucune donnée pour cette période
                        </div>
                    )}
                </div>
            </Card>
        </motion.div>
    )
}
