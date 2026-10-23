import { Badge } from "@/shared/ui/atoms/badge"
import { cn } from "@/shared/lib/utils"
import { ARRIVAGE_STATUS_CONFIG } from "@/features/stock/constants"
import type { ArrivageStatus } from "@/features/stock/types/stock.types"

/**
 * Statut d'un arrivage, avec sa pastille « positionné automatiquement ».
 *
 * Volontairement distinct de `molecules/status-badge` : celui-ci porte en plus
 * la pastille ambre pulsante de `status_auto`, propre au cycle de vie d'un
 * arrivage, et n'a qu'un seul consommateur. Le critère de promotion vers le
 * socle est la réutilisation prouvée (≥ 2 features), pas l'anticipation.
 */
export function ArrivageStatusBadge({
    status,
    auto,
}: {
    status: ArrivageStatus
    auto: boolean
}) {
    const cfg = ARRIVAGE_STATUS_CONFIG[status] ?? ARRIVAGE_STATUS_CONFIG["planifié"]

    return (
        <div className="flex items-center gap-1">
            <Badge
                variant="outline"
                className={cn("text-3xs px-1.5 py-0 font-medium whitespace-nowrap", cfg.className)}
            >
                {cfg.label}
            </Badge>
            {auto && (
                <span
                    className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400 dark:bg-amber-500 shrink-0 animate-pulse"
                    title="Statut positionné automatiquement — confirmation requise"
                    aria-label="Statut automatique"
                />
            )}
        </div>
    )
}
