import { AlertTriangle, CheckCircle2 } from "lucide-react"
import { CARTON_ETAT_LABEL } from "@/features/commandes/constants"
import { formatKg } from "@/features/commandes/utils/commandeAvancement"
import type { Carton } from "@/features/commandes/types/commande.types"

/**
 * Écarts de réception d'une livraison, en kilos : la base du traitement
 * logistique (renvoi) et de la régularisation avec la boutique.
 */
export function EcartsPanel({ cartons }: { cartons: readonly Carton[] }) {
    const ecarts = cartons.filter((c) => c.ecart_kg > 0)
    const total = ecarts.reduce((s, c) => s + c.ecart_kg, 0)

    if (ecarts.length === 0) {
        const recus = cartons.filter((c) => c.statut === "recu_conforme").length
        if (recus === 0) return null
        return (
            <p className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-sm text-success">
                <CheckCircle2 size={16} />
                Aucun écart sur les {recus} carton{recus > 1 ? "s" : ""} reçu{recus > 1 ? "s" : ""}.
            </p>
        )
    }

    return (
        <div className="overflow-hidden rounded-xl border border-destructive/30">
            <div className="flex items-center justify-between gap-2 bg-destructive/10 px-3 py-2">
                <span className="flex items-center gap-2 text-sm font-semibold text-destructive">
                    <AlertTriangle size={16} />
                    {ecarts.length} écart{ecarts.length > 1 ? "s" : ""} de réception
                </span>
                <span className="text-sm font-bold tabular-nums">{formatKg(total)}</span>
            </div>
            <ul className="divide-y divide-border text-sm">
                {ecarts.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-2">
                        <span className="w-28 font-mono text-xs font-semibold">{c.code}</span>
                        <span className="font-medium text-destructive">{c.etat ? CARTON_ETAT_LABEL[c.etat] : "—"}</span>
                        <span className="min-w-0 flex-1 truncate text-muted-foreground">{c.category_nom}</span>
                        <span className="tabular-nums">
                            {c.etat === "ecart_poids"
                                ? `${c.poids_kg_prevu} → ${c.poids_kg_recu} kg`
                                : `${c.poids_kg_prevu} kg`}
                        </span>
                        <span className="w-20 text-right font-semibold tabular-nums">− {formatKg(c.ecart_kg)}</span>
                        {c.note_reception && <span className="basis-full text-xs italic text-muted-foreground sm:pl-28">« {c.note_reception} »</span>}
                    </li>
                ))}
            </ul>
        </div>
    )
}
