import { ClipboardList, FileUp } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { GESTION_THEME } from "@/features/stock/theme"
import type { PackingListSummary } from "@/features/stock/types/packing-list.types"
import { PackingStatusBadge } from "./PackingStatusBadge"
import { formatKg, formatPackages, formatQty } from "./packingFormat"

interface ArrivagePackingSectionProps {
    /** `null` : l'arrivage n'a pas de packing list. */
    packing: PackingListSummary | null
    onOpen: () => void
}

function actionLabel(packing: PackingListSummary): string {
    switch (packing.status) {
        case "a_verifier":
            // On annonce ce qui BLOQUE, pas le volume total : « 74 lignes à
            // classer » dit le travail restant, « 139 lignes » décourage.
            return packing.lines_unmatched > 0
                ? `Vérifier (${packing.lines_unmatched} ligne${packing.lines_unmatched > 1 ? "s" : ""} à classer)`
                : "Terminer la vérification"
        case "en_traitement":
            return "Suivre l'import"
        case "echec":
            return "Voir l'erreur"
        default:
            return "Voir la packing list"
    }
}

/**
 * Section « Packing list » de la fiche d'un arrivage. Purement
 * présentationnelle : la fiche reste testable sans Supabase, et c'est
 * `FlowBoard` qui décide si l'utilisateur a le droit d'ouvrir la packing.
 */
export function ArrivagePackingSection({ packing, onOpen }: ArrivagePackingSectionProps) {
    return (
        <section className="space-y-3">
            <div className="flex items-center gap-2">
                <ClipboardList size={13} className="text-muted-foreground" aria-hidden />
                <h3 className={GESTION_THEME.section.groupTitle}>Packing list</h3>
                {packing && <PackingStatusBadge status={packing.status} />}
            </div>

            {packing ? (
                <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1 text-xs text-muted-foreground">
                        {packing.source_filename && (
                            <p className="truncate font-medium text-foreground">{packing.source_filename}</p>
                        )}
                        <p className="tabular-nums">
                            {formatPackages(packing.total_packages)} · {packing.line_count} ligne
                            {packing.line_count > 1 ? "s" : ""}
                            {packing.total_pieces > 0 && <> · {formatQty(packing.total_pieces)}</>}
                            {packing.total_weight_kg > 0 && <> · {formatKg(packing.total_weight_kg)}</>}
                        </p>
                        {packing.lines_from_dictionary + packing.lines_from_model > 0 &&
                            packing.status === "a_verifier" && (
                                <p className="tabular-nums text-success">
                                    {packing.lines_from_dictionary + packing.lines_from_model} ligne
                                    {packing.lines_from_dictionary + packing.lines_from_model > 1 ? "s" : ""} déjà
                                    reconnue
                                    {packing.lines_from_dictionary + packing.lines_from_model > 1 ? "s" : ""}{" "}
                                    automatiquement
                                </p>
                            )}
                    </div>
                    <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={onOpen}>
                        {actionLabel(packing)}
                    </Button>
                </div>
            ) : (
                <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-border px-4 py-3 sm:flex-row sm:items-center">
                    <p className="flex-1 text-xs text-muted-foreground">
                        Aucune packing list. Importez le fichier du fournisseur pour détailler le contenu du
                        conteneur.
                    </p>
                    <Button type="button" size="sm" variant="outline" className="shrink-0 gap-1.5" onClick={onOpen}>
                        <FileUp size={13} aria-hidden />
                        Importer une packing list
                    </Button>
                </div>
            )}
        </section>
    )
}
