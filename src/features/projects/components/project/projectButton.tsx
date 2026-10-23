import { Button } from "@/shared/ui/atoms/button"
import type { LucideIcon } from "lucide-react"
import { KanbanSquare } from "lucide-react"

interface ProjectButtonProps {
    id: string
    name: string
    isSelected: boolean
    onSelect: (id: string) => void
    icon?: LucideIcon
    suffix?: React.ReactNode
}

export function ProjectButton({
    id,
    name,
    isSelected,
    onSelect,
    icon: Icon = KanbanSquare,
    suffix,
}: ProjectButtonProps) {
    return (
        <Button
            variant={isSelected ? "default" : "outline"}
            className="gap-2"
            onClick={() => onSelect(id)}
        >
            <Icon className="h-4 w-4" />
            {name}
            {suffix}
        </Button>
    )
}
