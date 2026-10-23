"use client"

import { Edit2, Globe, Puzzle, Trash2 } from "lucide-react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { Badge } from "@/shared/ui/atoms/badge"
import { Button } from "@/shared/ui/atoms/button"
import { Card, CardContent } from "@/shared/ui/atoms/card"
import { Switch } from "@/shared/ui/atoms/switch"
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/shared/ui/atoms/tooltip"
import { getTimeDiffInfo } from "../../utils/timeRules"
import type { MaintenanceWindow } from "../../types/maintenance.types"
import { featureLabel } from "./maintenanceFeatures"

interface Props {
    window: MaintenanceWindow
    onToggleActive: (next: boolean) => void
    onEdit: () => void
    onDelete: () => void
}

function formatDate(iso: string) {
    return format(new Date(iso), "d MMM yyyy 'à' HH'h'mm", { locale: fr })
}

/**
 * Une fenêtre de maintenance dans la console.
 *
 * Les règles horaires reprises de l'existant (`utils/timeRules.ts`)
 * restent en vigueur :
 *   - édition verrouillée à moins de 12 h du créneau ;
 *   - activation autorisée seulement dans les 4 h qui le précèdent.
 * Elles n'ont pas d'équivalent en base — ce sont des garde-fous
 * d'exploitation, pas des invariants de données.
 */
export function MaintenanceWindowCard({
    window: maintenance,
    onToggleActive,
    onEdit,
    onDelete,
}: Props) {
    const isGlobal = maintenance.scope === "global"
    const { lessThan4h, lessThan12h, inPast } = getTimeDiffInfo(
        maintenance.starts_at
    )

    const canActivate = lessThan4h || inPast
    const Icon = isGlobal ? Globe : Puzzle

    return (
        <Card variant={maintenance.active ? "elevated" : "default"}>
            <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <Icon className="size-4 shrink-0 text-muted-foreground" />
                        <span className="font-medium">
                            {isGlobal
                                ? "Application entière"
                                : featureLabel(maintenance.feature_key)}
                        </span>
                        {maintenance.active ? (
                            <Badge variant="destructive">En cours</Badge>
                        ) : (
                            <Badge variant="secondary">Programmée</Badge>
                        )}
                    </div>

                    <p className="text-sm text-muted-foreground">
                        Du {formatDate(maintenance.starts_at)}
                        {maintenance.ends_at
                            ? ` au ${formatDate(maintenance.ends_at)}`
                            : ""}
                    </p>

                    {maintenance.message && (
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                            {maintenance.message}
                        </p>
                    )}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            {/* Le Switch désactivé n'émet pas d'événement de
                                survol : l'enrober permet au tooltip d'expliquer
                                pourquoi il est verrouillé. */}
                            <div>
                                <Switch
                                    checked={maintenance.active}
                                    disabled={
                                        !maintenance.active && !canActivate
                                    }
                                    onCheckedChange={onToggleActive}
                                    aria-label={
                                        maintenance.active
                                            ? "Lever la maintenance"
                                            : "Activer la maintenance"
                                    }
                                />
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>
                            {maintenance.active
                                ? "Lever la maintenance"
                                : canActivate
                                  ? "Activer la maintenance"
                                  : "Activation possible dans les 4 heures précédant le créneau."}
                        </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={onEdit}
                                    disabled={
                                        lessThan12h && !maintenance.active
                                    }
                                    aria-label="Modifier"
                                >
                                    <Edit2 className="size-4" />
                                </Button>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>
                            {lessThan12h && !maintenance.active
                                ? "Édition bloquée dans les 12 heures précédant le créneau."
                                : "Modifier"}
                        </TooltipContent>
                    </Tooltip>

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onDelete}
                        aria-label="Supprimer"
                    >
                        <Trash2 className="size-4 text-destructive" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
