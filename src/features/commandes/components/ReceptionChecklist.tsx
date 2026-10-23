import { AlertTriangle, CheckCircle2, Circle } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { CARTON_ETAT_LABEL } from "@/features/commandes/constants"
import type { Carton } from "@/features/commandes/types/commande.types"

/**
 * Les cartons de la livraison, cochés au fil des scans : ce qui reste à
 * scanner d'abord, puis ce qui est reçu (vert) ou en écart (orange). La
 * boutique voit d'un regard où elle en est.
 */
export function ReceptionChecklist({ cartons }: { cartons: readonly Carton[] }) {
    if (cartons.length === 0) return null
    const attendus = cartons.filter((c) => c.statut === "expedie")
    const traites = cartons.filter((c) => c.statut !== "expedie" && c.statut !== "prepare")
    return (
        <section className="flex flex-col gap-2" aria-label="Cartons de la livraison">
            {attendus.length > 0 && <Groupe titre={`À scanner · ${attendus.length}`} cartons={attendus} />}
            {traites.length > 0 && <Groupe titre={`Traités · ${traites.length}`} cartons={traites} />}
        </section>
    )
}

function Groupe({ titre, cartons }: { titre: string; cartons: readonly Carton[] }) {
    return (
        <div className="flex flex-col gap-1">
            <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{titre}</h3>
            <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                {cartons.map((c) => {
                    const ok = c.statut === "recu_conforme"
                    const ecart = c.statut === "recu_ecart" || c.statut === "manquant"
                    return (
                        <li key={c.id} className={cn("flex min-h-12 items-center gap-3 px-3 py-2 text-sm", ok && "bg-success/5", ecart && "bg-warning/5")}>
                            {ok ? <CheckCircle2 size={18} className="shrink-0 text-success" aria-label="Reçu" />
                                : ecart ? <AlertTriangle size={18} className="shrink-0 text-warning" aria-label="Écart" />
                                    : <Circle size={18} className="shrink-0 text-muted-foreground/50" aria-label="À scanner" />}
                            <span className="w-24 shrink-0 font-mono text-xs font-semibold">{c.code}</span>
                            <span className="min-w-0 flex-1 truncate">{c.category_nom}</span>
                            <span className="shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                                {ecart && c.etat ? <span className="font-medium text-warning">{CARTON_ETAT_LABEL[c.etat]}</span> : `${c.poids_kg_prevu} kg`}
                            </span>
                        </li>
                    )
                })}
            </ul>
        </div>
    )
}
