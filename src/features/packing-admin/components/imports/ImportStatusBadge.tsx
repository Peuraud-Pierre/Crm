import { Badge } from "@/shared/ui/atoms/badge"
import { cn } from "@/shared/lib/utils"
import { IMPORT_STATUS_LABELS } from "@/features/packing-admin/constants"
import type { PackingImportRow } from "@/features/packing-admin/types"

const TONE: Record<string, string> = {
    validee: "border-success/40 bg-success-light text-success",
    a_verifier: "border-warning/40 text-warning",
    echec: "border-destructive/40 text-destructive",
    en_traitement: "border-primary/40 text-primary",
}

export function ImportStatusBadge({ status }: { status: PackingImportRow["status"] }) {
    return (
        <Badge variant="outline" className={cn("text-2xs", TONE[status])}>
            {IMPORT_STATUS_LABELS[status] ?? status}
        </Badge>
    )
}
