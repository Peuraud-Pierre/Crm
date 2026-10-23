import { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { cn } from "@/shared/lib/utils"
import { useProjectListContext } from "@/features/projects/hooks/context/projectListContext"
import { useTaskContext } from "@/features/projects/hooks/context/taskContext"
import { PRIORITY_META } from "@/features/projects/project_constants"
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/shared/ui/atoms/tooltip"
import type { ProjectTask } from "@/features/projects/types"

const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]
const MONTHS = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
]

export function CalendarView() {
    const [currentDate, setCurrentDate] = useState(() => {
        const d = new Date()
        return new Date(d.getFullYear(), d.getMonth(), 1)
    })

    const { TASK_STATUS_COLUMNS } = useProjectListContext()
    const { tasksByStatus, setDetailTask } = useTaskContext()

    const allTasks = TASK_STATUS_COLUMNS.flatMap(
        (col) => tasksByStatus[col.key] ?? []
    )

    const tasksByDate = allTasks.reduce<Record<string, ProjectTask[]>>((acc, task) => {
        if (!task.due_date) return acc
        const dateKey = task.due_date.split("T")[0]
        if (!acc[dateKey]) acc[dateKey] = []
        acc[dateKey].push(task)
        return acc
    }, {})

    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    const firstDayRaw = new Date(year, month, 1).getDay()
    const firstDayMon = (firstDayRaw + 6) % 7

    const daysInMonth = new Date(year, month + 1, 0).getDate()

    const cells: (number | null)[] = [
        ...Array(firstDayMon).fill(null),
        ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ]
    while (cells.length % 7 !== 0) cells.push(null)

    const today = new Date()
    const isCurrentMonth =
        today.getFullYear() === year && today.getMonth() === month

    const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1))
    const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1))
    const goToday = () =>
        setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1))

    const tasksWithoutDate = allTasks.filter((t) => !t.due_date)

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={prevMonth}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <h3 className="min-w-[120px] text-center text-sm font-semibold sm:min-w-[160px]">
                        {MONTHS[month]} {year}
                    </h3>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={nextMonth}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
                <Button variant="outline" size="sm" onClick={goToday}>
                    Aujourd'hui
                </Button>
            </div>

            <div className="overflow-hidden rounded-lg border">
                <div className="grid grid-cols-7 border-b bg-muted/50">
                    {DAYS.map((day) => (
                        <div
                            key={day}
                            className="py-2 text-center text-xs font-semibold text-muted-foreground"
                        >
                            {day}
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-7">
                    {cells.map((day, idx) => {
                        if (day === null) {
                            return (
                                <div
                                    // idx is a stable calendar-grid slot (fixed-size month grid, never reordered)
                                    // eslint-disable-next-line react-x/no-array-index-key
                                    key={`empty-${year}-${month}-${idx}`}
                                    className="h-16 border-b border-r last:border-r-0 bg-muted/10 sm:h-28"
                                />
                            )
                        }

                        const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                        const dayTasks = tasksByDate[dateKey] ?? []
                        const isToday = isCurrentMonth && day === today.getDate()

                        return (
                            <div
                                key={dateKey}
                                className={cn(
                                    "h-16 overflow-hidden border-b border-r p-1 last:border-r-0 sm:h-28 sm:p-1.5",
                                    isToday && "bg-primary/5"
                                )}
                            >
                                <div
                                    className={cn(
                                        "mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs",
                                        isToday
                                            ? "bg-primary font-bold text-primary-foreground"
                                            : "text-muted-foreground"
                                    )}
                                >
                                    {day}
                                </div>
                                <div className="space-y-0.5 overflow-hidden">
                                    {dayTasks.length > 0 && (
                                        <p className="px-1 text-[10px] font-medium text-muted-foreground sm:hidden">
                                            {dayTasks.length}
                                        </p>
                                    )}
                                    <div className="hidden sm:block space-y-0.5">
                                        {dayTasks.slice(0, 3).map((task) => (
                                            <Tooltip key={task.id}>
                                                <TooltipTrigger asChild>
                                                    <button
                                                        type="button"
                                                        onClick={() => setDetailTask(task)}
                                                        className={cn(
                                                            "w-full truncate rounded px-1 py-0.5 text-left text-[10px] font-medium transition-opacity hover:opacity-75",
                                                            PRIORITY_META[task.priority].badgeClass
                                                        )}
                                                    >
                                                        {task.title}
                                                    </button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p className="font-medium">{task.title}</p>
                                                    <p className="text-xs opacity-70">
                                                        {PRIORITY_META[task.priority].label}
                                                    </p>
                                                </TooltipContent>
                                            </Tooltip>
                                        ))}
                                        {dayTasks.length > 3 && (
                                            <p className="px-1 text-[10px] text-muted-foreground">
                                                +{dayTasks.length - 3} autres
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {tasksWithoutDate.length > 0 && (
                <div className="rounded-md border bg-muted/20 px-4 py-3">
                    <p className="mb-2 text-xs font-semibold text-muted-foreground">
                        Sans échéance ({tasksWithoutDate.length})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                        {tasksWithoutDate.map((task) => (
                            <button
                                key={task.id}
                                type="button"
                                onClick={() => setDetailTask(task)}
                                className={cn(
                                    "rounded px-2 py-0.5 text-xs font-medium transition-opacity hover:opacity-75",
                                    PRIORITY_META[task.priority].badgeClass
                                )}
                            >
                                {task.title}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
