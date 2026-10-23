import {
    Bar,
    BarChart,
    Cell,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts"
import { useTaskContext } from "@/features/projects/hooks/context/taskContext"
import { RECHARTS_TOOLTIP_THEME } from "@/shared/lib/rechartsTooltip"

/**
 * Statuts de tâche : les couleurs portent une SÉMANTIQUE (en cours / à revoir /
 * terminé), pas une simple différenciation de séries — d'où les tokens
 * sémantiques plutôt que la palette catégorielle `--chart-*`.
 * Les valeurs étaient auparavant des HSL littéraux, identiques en clair et en
 * sombre (design system §12.4).
 */
const STATUS_COLORS: Record<string, string> = {
    todo: "hsl(var(--muted-foreground))",
    in_progress: "hsl(var(--chart-2))",
    review: "hsl(var(--warning))",
    done: "hsl(var(--success))",
}

export function SprintDistributionChart() {
    const { sprintStats } = useTaskContext()

    if (!sprintStats) return null

    const total =
        sprintStats.todo +
        sprintStats.in_progress +
        sprintStats.review +
        sprintStats.done

    if (total === 0) return null

    const data = [
        { name: "À faire", value: sprintStats.todo, key: "todo" },
        { name: "En cours", value: sprintStats.in_progress, key: "in_progress" },
        { name: "En test", value: sprintStats.review, key: "review" },
        { name: "Terminé", value: sprintStats.done, key: "done" },
    ]

    return (
        <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                Répartition des tâches
            </p>
            <div className="h-[130px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={data}
                        layout="vertical"
                        margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
                    >
                        <XAxis
                            type="number"
                            tick={{ fontSize: 10 }}
                            tickLine={false}
                            axisLine={false}
                            allowDecimals={false}
                        />
                        <YAxis
                            dataKey="name"
                            type="category"
                            width={58}
                            tick={{ fontSize: 11 }}
                            tickLine={false}
                            axisLine={false}
                        />
                        <Tooltip
                            {...RECHARTS_TOOLTIP_THEME}
                            cursor={{ fill: "hsl(var(--muted))" }}
                            formatter={(value) => [
                                `${value as number} tâche${(value as number) > 1 ? "s" : ""}`,
                                "",
                            ]}
                        />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={20}>
                            {data.map((entry) => (
                                <Cell
                                    key={entry.key}
                                    fill={STATUS_COLORS[entry.key]}
                                />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}
