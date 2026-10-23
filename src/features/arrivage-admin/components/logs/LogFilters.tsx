import { Search, X } from "lucide-react"
import { Badge } from "@/shared/ui/atoms/badge"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import { cn } from "@/shared/lib/utils"
import { LOG_LEVELS } from "@/features/arrivage-admin/constants"
import { LogDateRangePicker } from "@/features/arrivage-admin/components/logs/LogDateRangePicker"
import type { LogFilters as LogFiltersValue } from "@/features/arrivage-admin/types"

interface LogFiltersProps {
    filters: LogFiltersValue
    onChange: (next: LogFiltersValue) => void
}

/**
 * Barre de filtres de la console. Les niveaux sont des bascules cumulables
 * (aucun sélectionné = tous), la recherche porte sur le message et le chemin.
 */
export function LogFilters({ filters, onChange }: LogFiltersProps) {
    const toggleLevel = (level: string) => {
        const next = filters.levels.includes(level)
            ? filters.levels.filter(l => l !== level)
            : [...filters.levels, level]
        onChange({ ...filters, levels: next })
    }

    return (
        <div className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={filters.search}
                        onChange={e =>
                            onChange({ ...filters, search: e.target.value })
                        }
                        placeholder="Rechercher (message, chemin)…"
                        className="pl-9"
                        aria-label="Rechercher dans les logs"
                    />
                </div>

                <LogDateRangePicker
                    since={filters.since}
                    until={filters.until}
                    onChange={(since, until) =>
                        onChange({ ...filters, since, until })
                    }
                />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
                {LOG_LEVELS.map(level => {
                    const active = filters.levels.includes(level)
                    return (
                        <Button
                            key={level}
                            type="button"
                            size="sm"
                            variant={active ? "default" : "outline"}
                            onClick={() => toggleLevel(level)}
                            aria-pressed={active}
                            className={cn(
                                "px-2.5 text-xs transition-colors",
                                // Un filtre ERROR actif doit se lire comme tel.
                                active &&
                                    level === "ERROR" &&
                                    "bg-destructive text-destructive-foreground hover:bg-destructive/90",
                                active &&
                                    level === "WARN" &&
                                    "bg-warning text-warning-foreground hover:bg-warning/90"
                            )}
                        >
                            {level}
                        </Button>
                    )
                })}

                {/* Le filtre par requête ne se saisit pas : il s'active en
                    cliquant le req_id d'une ligne. On n'offre donc que le
                    moyen de le retirer. */}
                {filters.reqId && (
                    <Badge variant="secondary" className="gap-1 font-mono">
                        req {filters.reqId}
                        <button
                            type="button"
                            onClick={() => onChange({ ...filters, reqId: "" })}
                            aria-label="Retirer le filtre de requête"
                            className="ml-0.5 rounded-sm hover:text-foreground"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </Badge>
                )}
            </div>
        </div>
    )
}
