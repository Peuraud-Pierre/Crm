import { cn } from "@/shared/lib/utils"

export interface StatusBadgeConfig {
    label: string
    /** Classes d'habillage : fond, texte, bordure. */
    className: string
}

interface StatusBadgeProps {
    config: StatusBadgeConfig
    size?: "sm" | "md"
    className?: string
}

/**
 * Pastille de statut. Ne connaît aucun statut : elle reçoit son libellé et son
 * habillage déjà résolus.
 *
 * C'est la contrepartie du fait que chaque module déclare ses statuts dans ses
 * constantes (`BALLE_STATUS_CONFIG`, `ARRIVAGE_STATUS_CONFIG`…) : la table de
 * correspondance reste métier, le rendu est commun. Auparavant chaque écran
 * réécrivait ses propres classes de pastille, avec des arrondis et des tailles
 * de police qui divergeaient d'un module à l'autre.
 */
export function StatusBadge({ config, size = "sm", className }: StatusBadgeProps) {
    return (
        <span
            className={cn(
                "inline-flex shrink-0 items-center rounded-md border font-medium",
                size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm",
                config.className,
                className,
            )}
        >
            {config.label}
        </span>
    )
}
