import { Eye } from "lucide-react"

/** Rappel affiché à un lecteur seul pendant qu'une packing attend sa vérification. */
export function ArrivagePackingSheetFallback() {
    return (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Eye size={13} aria-hidden />
            Consultation seule : la vérification demande le droit de modifier les packing lists.
        </p>
    )
}
