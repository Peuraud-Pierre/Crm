import { motion } from "framer-motion"
import { useAnalytics } from "../../../context/AnalyticsContext"
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts"
import { Card } from "@/shared/ui/atoms/card"
import { RECHARTS_TOOLTIP_THEME } from "@/shared/lib/rechartsTooltip"
import { PieChart as PieChartIcon } from "lucide-react"

export function WidgetRdvByType() {
    const { rdvByTypeData } = useAnalytics()

    return (
        <motion.div
            key="w-rdv-type"
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
        >
            <Card className="p-4 sm:p-6 border-border/50 h-full min-h-[380px] flex flex-col">
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <h3 className="text-base sm:text-lg font-bold">
                            Types de RDV pris
                        </h3>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                            Sur un total de {rdvByTypeData.total} RDV
                        </p>
                    </div>
                    <div className="p-2 bg-blue-500/10 rounded-lg shrink-0">
                        <PieChartIcon className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                    </div>
                </div>
                <div className="flex-1 flex items-center justify-center">
                    {rdvByTypeData.total > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={rdvByTypeData.data}
                                    cx="50%"
                                    cy="45%"
                                    innerRadius={60}
                                    outerRadius={90}
                                    paddingAngle={3}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {rdvByTypeData.data.map((entry) => (
                                        <Cell key={entry.name} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    {...RECHARTS_TOOLTIP_THEME}
                                    formatter={(value, name) => [
                                        `${Number(value)} RDV (${Math.round(
                                            (Number(value) / rdvByTypeData.total) * 100
                                        )}%)`,
                                        String(name),
                                    ] as [string, string]}
                                />
                                <Legend
                                    verticalAlign="bottom"
                                    height={36}
                                    wrapperStyle={{ fontSize: "11px" }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
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
