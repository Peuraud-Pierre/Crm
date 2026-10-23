import { PackageSearch } from "lucide-react"
import { Link } from "react-router"
import { DetailSheet } from "@/shared/ui/organisms/detail-sheet"
import { Button } from "@/shared/ui/atoms/button"
import { formatConfidence, formatDateTime, formatShare } from "@/features/packing-admin/utils/format"
import type { PackingImportRow } from "@/features/packing-admin/types"
import { ImportsBreakdown } from "./ImportsBreakdown"
import { ImportStatusBadge } from "./ImportStatusBadge"

interface ImportDetailSheetProps {
    row: PackingImportRow | null
    onClose: () => void
}

/**
 * Détail d'un import. Lecture seule, et volontairement : les corrections se font
 * là où le travail se fait — la sheet de revue de l'arrivage — avec la
 * traçabilité qui va avec. Un raccourci y mène.
 */
export function ImportDetailSheet({ row, onClose }: ImportDetailSheetProps) {
    if (!row) return null

    const lines = row.lines
    const total = lines ? lines.dictionary + lines.model + lines.suggested + lines.none : 0
    const untouched = lines && total > 0 ? (lines.dictionary + lines.model) / total : null

    return (
        <DetailSheet
            open
            onOpenChange={(next) => {
                if (!next) onClose()
            }}
            icon={PackageSearch}
            title={row.container_label ?? "Import sans titre"}
            subtitle={`Importé le ${formatDateTime(row.imported_at)}`}
            badge={<ImportStatusBadge status={row.status} />}
            footer={
                // `Link` et non `<a href>` : un `href` rechargerait toute
                // l'application pour une navigation interne.
                <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
                    <Link to={`/stock/flux/${row.arrivage_manuel_id}`}>Ouvrir l'arrivage</Link>
                </Button>
            }
        >
            <div className="flex flex-col gap-5">
                {row.status === "echec" && (
                    <section className="flex flex-col gap-1 rounded-lg border border-destructive/40 px-3 py-2">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-destructive">
                            Message d'erreur
                        </h3>
                        <p className="text-sm text-foreground">
                            {row.error_message ?? "Aucun message enregistré par le service."}
                        </p>
                    </section>
                )}

                <section className="flex flex-col gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Répartition des {total} ligne(s)
                    </h3>
                    <ImportsBreakdown lines={lines} />
                    {lines ? (
                        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
                            <Field label="Reconnues" value={lines.dictionary} />
                            <Field label="Par le modèle" value={lines.model} />
                            <Field label="Proposées" value={lines.suggested} />
                            <Field label="À trancher" value={lines.none} />
                        </dl>
                    ) : (
                        <p className="text-xs text-muted-foreground">
                            Cet import est antérieur à l'apprentissage : sa répartition n'a pas été
                            mesurée. Ce n'est pas la même chose que « rien n'a été reconnu ».
                        </p>
                    )}
                </section>

                <section className="flex flex-col gap-2 border-t border-border pt-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Au moment de l'import
                    </h3>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                        <Field
                            label="Sans intervention"
                            value={formatShare(untouched)}
                        />
                        <Field
                            label="Seuil en vigueur"
                            value={row.threshold === null ? "Aucun (pas d'auto)" : formatConfidence(row.threshold)}
                        />
                        <Field label="Fichier" value={row.source_filename ?? "—"} />
                    </dl>
                </section>
            </div>
        </DetailSheet>
    )
}

function Field({ label, value }: { label: string; value: string | number }) {
    return (
        <div className="flex flex-col">
            <dt className="text-2xs uppercase tracking-wider text-muted-foreground">{label}</dt>
            <dd className="truncate font-medium tabular-nums text-foreground">{value}</dd>
        </div>
    )
}
