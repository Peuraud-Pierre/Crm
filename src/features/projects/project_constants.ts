import type { TaskPriority, TaskStatus } from "@/features/projects/types"
import { CHART_PALETTE } from "@/shared/lib/chartPalette"

export const PRIORITY_META: Record<
    TaskPriority,
    { label: string; badgeClass: string; color: string }
> = {
    // `badgeClass` est aligné sur `color` : les deux décrivaient la même priorité
    // avec deux systèmes de couleur différents, et seul `color` était tokenisé.
    Urgent: { label: "Urgent", badgeClass: "bg-destructive/10 text-destructive", color: "hsl(var(--destructive))" },
    Haute: { label: "Haute", badgeClass: "bg-chart-5/10 text-chart-5", color: "hsl(var(--chart-5))" },
    Normal: { label: "Normale", badgeClass: "bg-chart-4/10 text-chart-4", color: "hsl(var(--chart-4))" },
    Basse: { label: "Basse", badgeClass: "bg-success/10 text-success", color: "hsl(var(--success))" },
    Nouveau: { label: "Nouveau", badgeClass: "bg-chart-2/10 text-chart-2", color: "hsl(var(--chart-2))" },
}

export const PRIORITY_ORDER: TaskPriority[] = [
    "Urgent",
    "Haute",
    "Normal",
    "Basse",
    "Nouveau",
]

export const TASK_STATUS_COLUMNS: Array<{
    key: TaskStatus
    label: string
    hint: string
}> = [
    { key: "todo", label: "À faire", hint: "Cartes non commencées" },
    { key: "in_progress", label: "En cours", hint: "Travail en cours" },
    { key: "review", label: "En test", hint: "En validation" },
    { key: "done", label: "Terminé", hint: "Livré" },
]

export const MEMBER_COLOR_PALETTE = CHART_PALETTE
