import { ConfirmAction } from "@/shared/ui/molecules/confirm-action"
import type { DeleteTarget } from "@/features/magasins/hooks/ui/usePlanDeletion"

interface PlanItemDeleteProps {
    target: DeleteTarget | null
    onClose: () => void
    /** Appelé après une suppression réussie. */
    onDeleted: (target: DeleteTarget) => void
}

/** Confirmation de suppression d'un élément ou d'un mur du plan. */
export function PlanItemDelete({ target, onClose, onDeleted }: PlanItemDeleteProps) {
    if (!target) return null
    return (
        <ConfirmAction
            open
            onOpenChange={(open) => !open && onClose()}
            title={target.title}
            description={target.description}
            confirmLabel="Supprimer"
            destructive
            onConfirm={async () => {
                const ok = await target.remove()
                if (ok) onDeleted(target)
                return ok
            }}
        />
    )
}
