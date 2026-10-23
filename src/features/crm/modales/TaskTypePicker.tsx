import { ChevronDown, Instagram } from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from "@/shared/ui/atoms/dropdown-menu"
import { CRM_TASK_TYPES, INSTA_TASK_TYPES } from "../utils/taskTypes"

interface TaskTypePickerProps {
    type: string | null | undefined
    onSelect: (type: string, categorie: "crm" | "insta") => void
}

/**
 * Sélecteur du type de tâche (sous-menus CRM / Insta). Partagé entre les
 * dialogs de création et d'édition de TaskModals.tsx.
 */
export function TaskTypePicker({ type, onSelect }: TaskTypePickerProps) {
    return (
        <div className="space-y-2">
            <label className="text-sm font-medium text-secondary-foreground">
                Type
            </label>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button
                        type="button"
                        className="flex h-9 w-full items-center justify-between rounded-md border border-border bg-card px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none"
                    >
                        <span>{type || "Sélectionner un type"}</span>
                        <ChevronDown className="h-4 w-4 opacity-50" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger className="gap-2 text-sm">
                            CRM
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="w-48">
                            {CRM_TASK_TYPES.map((t) => (
                                <DropdownMenuItem
                                    key={t}
                                    onClick={() => onSelect(t, "crm")}
                                >
                                    {t}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger className="gap-2 text-sm">
                            <Instagram className="h-3.5 w-3.5" />
                            Insta
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="w-48">
                            {INSTA_TASK_TYPES.map((t) => (
                                <DropdownMenuItem
                                    key={t}
                                    onClick={() => onSelect(t, "insta")}
                                >
                                    {t}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    )
}
