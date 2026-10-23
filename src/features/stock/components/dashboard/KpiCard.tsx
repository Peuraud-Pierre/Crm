import type { ReactNode } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/shared/ui/atoms/card"

export function KpiCard({
    title, value, icon, hint, variant,
}: {
    title:    string
    value:    string | number
    icon:     ReactNode
    hint?:    string
    variant?: "warning" | "default"
}) {
    return (
        <Card className={variant === "warning" ? "border-amber-200 dark:border-amber-900/50" : ""}>
            <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-xs font-medium text-slate-500">{title}</CardTitle>
                <div className={variant === "warning" ? "text-amber-600" : "text-slate-400"}>
                    {icon}
                </div>
            </CardHeader>
            <CardContent className="pb-3">
                <div className="text-2xl font-semibold tabular-nums">{value}</div>
                {hint && <div className="text-xs text-slate-500 mt-0.5">{hint}</div>}
            </CardContent>
        </Card>
    )
}
