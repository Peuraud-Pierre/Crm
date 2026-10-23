import { AlertTriangle } from "lucide-react"
import { Badge } from "@/shared/ui/atoms/badge"
import { useTaskContext } from "@/features/projects/hooks/context/taskContext"

interface StatPillProps {
    label: string
    value: number
    colorClass: string
    dotClass: string
}

function StatPill({ label, value, colorClass, dotClass }: StatPillProps) {
    return (
        <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-2">
            <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} />
            <div className="min-w-0">
                <p className={`text-lg font-bold leading-none ${colorClass}`}>
                    {value}
                </p>
                <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                    {label}
                </p>
            </div>
        </div>
    )
}

export function SprintStats() {
    const { sprintStats } = useTaskContext()

    if (!sprintStats) return null

    return (
        <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <StatPill
                    label="À faire"
                    value={sprintStats.todo}
                    colorClass="text-foreground"
                    dotClass="bg-slate-400 dark:bg-slate-500"
                />
                <StatPill
                    label="En cours"
                    value={sprintStats.in_progress}
                    colorClass="text-blue-600 dark:text-blue-400"
                    dotClass="bg-blue-500 dark:bg-blue-600"
                />
                <StatPill
                    label="En test"
                    value={sprintStats.review}
                    colorClass="text-amber-600 dark:text-amber-400"
                    dotClass="bg-amber-500 dark:bg-amber-600"
                />
                <StatPill
                    label="Terminé"
                    value={sprintStats.done}
                    colorClass="text-green-600 dark:text-green-400"
                    dotClass="bg-green-500 dark:bg-green-600"
                />
            </div>

            {sprintStats.overdue > 0 && (
                <div className="flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                    <Badge variant="destructive" className="text-xs">
                        {sprintStats.overdue} tâche
                        {sprintStats.overdue > 1 ? "s" : ""} en retard
                    </Badge>
                </div>
            )}
        </div>
    )
}
