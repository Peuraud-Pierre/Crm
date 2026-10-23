import { Filter, Search, X } from "lucide-react"
import { Badge } from "@/shared/ui/atoms/badge"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"
import { useTaskContext } from "@/features/projects/hooks/context/taskContext"

const PRIORITY_OPTIONS = [
    { value: "Urgent", label: "Urgent" },
    { value: "Haute", label: "Haute" },
    { value: "Normal", label: "Normal" },
    { value: "Basse", label: "Basse" },
    { value: "Nouveau", label: "Nouveau" },
]

export function TaskFilters() {
    const {
        searchQuery,
        setSearchQuery,
        filterPriority,
        setFilterPriority,
        filterAssignee,
        setFilterAssignee,
        activeFilterCount,
        resetFilters,
        assigneeOptions,
    } = useTaskContext()

    return (
        <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Filter className="h-3.5 w-3.5" />
                <span>Filtres</span>
                {activeFilterCount > 0 && (
                    <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                        {activeFilterCount}
                    </Badge>
                )}
            </div>

            <div className="relative">
                <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                    className="h-8 w-44 pl-7 text-sm"
                    placeholder="Rechercher..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            <Select
                value={filterPriority}
                onValueChange={(v) =>
                    setFilterPriority(v as typeof filterPriority)
                }
            >
                <SelectTrigger className="h-8 w-32 text-sm">
                    <SelectValue placeholder="Priorité" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Toutes priorités</SelectItem>
                    {PRIORITY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {assigneeOptions.length > 0 && (
                <Select
                    value={filterAssignee}
                    onValueChange={setFilterAssignee}
                >
                    <SelectTrigger className="h-8 w-36 text-sm">
                        <SelectValue placeholder="Assigné" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Tous assignés</SelectItem>
                        {assigneeOptions.map((opt) => (
                            <SelectItem key={opt.id} value={opt.id}>
                                {opt.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            )}

            {activeFilterCount > 0 && (
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 px-2 text-xs text-muted-foreground"
                    onClick={resetFilters}
                >
                    <X className="h-3.5 w-3.5" />
                    Réinitialiser
                </Button>
            )}
        </div>
    )
}
