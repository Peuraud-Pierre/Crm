import { X } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import type { Permission } from "../../types"
import { categoryLabel } from "./categoryLabels"

export type PermissionChipVariant = "individual" | "inherited" | "plain"

interface PermissionChipProps {
    permission: Permission
    /**
     * `individual` : permission propre, retirable — plein.
     * `inherited` : héritée d'un rôle/service — bord pointillé, estompée.
     * `plain` : aperçu neutre (cartes rôles/services).
     */
    variant?: PermissionChipVariant
    /** Rend un bouton de retrait — réservé aux permissions modifiables. */
    onRemove?: () => void
    disabled?: boolean
}

const VARIANT_CLASSES: Record<PermissionChipVariant, string> = {
    individual: "border-transparent bg-secondary text-secondary-foreground",
    inherited: "border-dashed border-border text-muted-foreground",
    plain: "border-border bg-background text-foreground",
}

/**
 * LE chip de permission de la feature — même rendu sur les fiches
 * utilisateur/rôle/service, les cartes et le catalogue.
 */
export function PermissionChip({
    permission,
    variant = "plain",
    onRemove,
    disabled = false,
}: PermissionChipProps) {
    return (
        <span
            title={`${permission.code} • ${categoryLabel(permission.category ?? "Autres")}`}
            className={cn(
                "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                VARIANT_CLASSES[variant]
            )}
        >
            <span className="truncate">{permission.label}</span>
            {onRemove && (
                <button
                    type="button"
                    onClick={onRemove}
                    disabled={disabled}
                    aria-label={`Retirer ${permission.label}`}
                    className="shrink-0 rounded-full text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                >
                    <X className="h-3 w-3" />
                </button>
            )}
        </span>
    )
}
