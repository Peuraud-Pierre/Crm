import { Badge } from "@/shared/ui/atoms/badge"
import { cn } from "@/shared/lib/utils"
import { FLUX_STATUS_CONFIG } from "@/features/stock_handpick/constants"
import type { FluxStatus } from "@/features/stock_handpick/types/flux.types"

/**
 * Statut d'une expédition.
 *
 * Jumeau de `ArrivageStatusBadge` du stock principal, sans sa pastille « statut
 * automatique » : `flux_handpick` ne porte pas de `status_auto`.
 */
export function FluxStatusBadge({ status }: { status: FluxStatus }) {
    const cfg = FLUX_STATUS_CONFIG[status] ?? FLUX_STATUS_CONFIG["planifié"]

    return (
        <Badge
            variant="outline"
            className={cn("text-3xs px-1.5 py-0 font-medium whitespace-nowrap", cfg.className)}
        >
            {cfg.label}
        </Badge>
    )
}
