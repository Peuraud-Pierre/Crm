import { Badge } from "@/shared/ui/atoms/badge"
import {
    RUN_STATUS_LABELS,
    RUN_TRIGGER_LABELS,
} from "@/features/arrivage-admin/constants"
import type { RunStatus, RunTrigger } from "@/features/arrivage-admin/types"

type BadgeVariant = "default" | "secondary" | "success" | "warning" | "destructive"

const STATUS_VARIANTS: Record<RunStatus, BadgeVariant> = {
    running: "default",
    success: "success",
    partial: "warning",
    failed: "destructive",
    aborted: "destructive",
}

/** Statut d'un envoi, avec la couleur sémantique correspondante. */
export function RunStatusBadge({ status }: { status: RunStatus }) {
    return (
        <Badge variant={STATUS_VARIANTS[status]}>
            {RUN_STATUS_LABELS[status]}
        </Badge>
    )
}

/** Origine d'un envoi — neutre, c'est une information de contexte. */
export function RunTriggerBadge({ trigger }: { trigger: RunTrigger }) {
    return <Badge variant="outline">{RUN_TRIGGER_LABELS[trigger]}</Badge>
}
