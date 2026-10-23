import { cn } from "@/shared/lib/utils"
import { StatusBadge } from "@/shared/ui/molecules/status-badge"
import {
    CARTON_STATUS_CONFIG,
    COMMANDE_STATUS_CONFIG,
    LIVRAISON_BOUTIQUE_STATUS_CONFIG,
} from "@/features/commandes/constants"
import { segmentsAvancement } from "@/features/commandes/utils/commandeAvancement"
import type {
    AvancementLigne,
    CartonStatut,
    CommandeStatut,
    LivraisonBoutiqueStatut,
} from "@/features/commandes/types/commande.types"

/** Petites briques d'affichage partagées par les écrans de la salle de commande. */

export const CommandeBadge = ({ statut }: { statut: CommandeStatut }) => <StatusBadge config={COMMANDE_STATUS_CONFIG[statut]} />
export const LivraisonBadge = ({ statut }: { statut: LivraisonBoutiqueStatut }) => <StatusBadge config={LIVRAISON_BOUTIQUE_STATUS_CONFIG[statut]} />
export const CartonBadge = ({ statut }: { statut: CartonStatut }) => <StatusBadge config={CARTON_STATUS_CONFIG[statut]} />

/** Légende commune aux barres d'avancement. */
export const AVANCEMENT_LEGENDE = [
    { key: "recu", label: "Reçu", className: "bg-success" },
    { key: "expedie", label: "En transit", className: "bg-chart-2" },
    { key: "prepare", label: "Préparé", className: "bg-chart-4" },
    { key: "manquant", label: "Manquant", className: "bg-destructive" },
    { key: "reste", label: "Reste à servir", className: "bg-muted-foreground/25" },
] as const

/**
 * Barre segmentée d'une ligne de commande : reçu / en transit / préparé /
 * manquant / reste. Les couleurs sont des tokens d'ÉTAT (succès, alerte),
 * chaque segment a son libellé dans la légende et l'info-bulle — la couleur
 * n'est jamais seule à porter le sens.
 */
export function AvancementBar({ ligne, className }: {
    ligne: Pick<AvancementLigne, "kg_demande" | "kg_recu" | "kg_expedie" | "kg_prepare" | "kg_manquant" | "kg_reste">
    className?: string
}) {
    const s = segmentsAvancement(ligne)
    const kgOf = { recu: ligne.kg_recu, expedie: ligne.kg_expedie, prepare: ligne.kg_prepare, manquant: ligne.kg_manquant, reste: ligne.kg_reste }
    return (
        <div className={cn("flex h-2.5 w-full gap-px overflow-hidden rounded-full bg-muted", className)} role="img"
            aria-label={AVANCEMENT_LEGENDE.map((l) => `${l.label} ${Math.round(kgOf[l.key])} kg`).join(", ")}>
            {AVANCEMENT_LEGENDE.map((l) => s[l.key] > 0 && (
                <div
                    key={l.key}
                    className={l.className}
                    style={{ width: `${s[l.key]}%` }}
                    title={`${l.label} : ${kgOf[l.key].toLocaleString("fr-FR", { maximumFractionDigits: 1 })} kg`}
                />
            ))}
        </div>
    )
}

export function AvancementLegende() {
    return (
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {AVANCEMENT_LEGENDE.map((l) => (
                <li key={l.key} className="inline-flex items-center gap-1.5">
                    <span className={cn("h-2 w-2 rounded-sm", l.className)} aria-hidden />
                    {l.label}
                </li>
            ))}
        </ul>
    )
}

/** Barre simple « 7 / 12 cartons reçus ». */
export function ProgressCount({ done, total, tone = "success" }: { done: number; total: number; tone?: "success" | "warning" }) {
    const pct = total > 0 ? Math.min(100, (done / total) * 100) : 0
    return (
        <div className="flex items-center gap-2">
            <div className="h-1.5 w-full min-w-12 overflow-hidden rounded-full bg-muted">
                <div className={cn("h-full rounded-full", tone === "success" ? "bg-success" : "bg-warning")} style={{ width: `${pct}%` }} />
            </div>
            <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">{done}/{total}</span>
        </div>
    )
}
