import { useMemo, useState } from "react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { ChevronRight, Plus, ShoppingCart } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import { cn } from "@/shared/lib/utils"
import { useCommandeContext } from "@/features/commandes/hooks/context/CommandeContext"
import { formatKg, pourcentageRecu } from "@/features/commandes/utils/commandeAvancement"
import type { CommandeBoutique } from "@/features/commandes/types/commande.types"
import { AvancementBar, CommandeBadge } from "./commandeUi"

const enCours = (c: CommandeBoutique) => c.statut === "ouverte" || c.statut === "en_cours"

/** Une commande, vue de la boutique : où en est-elle, en une ligne et une barre. */
export function CommandeCard({ commande, onOpen }: { commande: CommandeBoutique; onOpen: () => void }) {
    const c = commande
    return (
        <button
            type="button"
            onClick={onOpen}
            className={cn(
                "flex w-full flex-col gap-2 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:bg-muted/40",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                c.statut === "annulee" && "opacity-60",
            )}
        >
            <span className="flex items-center gap-2">
                <span className="font-mono font-semibold">{c.code}</span>
                <CommandeBadge statut={c.statut} />
                <ChevronRight size={16} className="ml-auto shrink-0 text-muted-foreground" />
            </span>
            <span className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                <span className="tabular-nums"><span className="font-semibold">{formatKg(c.kg_recu)}</span> reçus sur {formatKg(c.kg_demande)}</span>
                <span className="text-xs text-muted-foreground">
                    {c.nb_lignes} catégorie{c.nb_lignes > 1 ? "s" : ""}
                    {c.date_souhaitee && ` · pour le ${format(new Date(`${c.date_souhaitee}T12:00:00`), "d MMM", { locale: fr })}`}
                </span>
            </span>
            {c.statut !== "annulee" && (
                <span className="flex items-center gap-2">
                    <AvancementBar ligne={{ kg_demande: c.kg_demande, kg_recu: c.kg_recu, kg_expedie: c.kg_expedie, kg_prepare: c.kg_prepare, kg_manquant: 0, kg_reste: c.kg_reste }} />
                    <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{Math.round(pourcentageRecu(c))} %</span>
                </span>
            )}
        </button>
    )
}

interface BoutiqueCommandesProps {
    boutiqueId: string
    onOpen: (commande: CommandeBoutique) => void
    onCreate?: () => void
}

/**
 * « Mes commandes » : ce que la boutique a demandé, en cours d'abord. Une
 * commande se modifie ou s'annule tant que l'entrepôt n'a rien préparé ;
 * ensuite elle se suit.
 */
export function BoutiqueCommandes({ boutiqueId, onOpen, onCreate }: BoutiqueCommandesProps) {
    const { commandes } = useCommandeContext()
    const [toutes, setToutes] = useState(false)
    const miennes = useMemo(() => commandes.filter((c) => c.boutique_id === boutiqueId), [commandes, boutiqueId])
    const visibles = toutes ? miennes : miennes.filter(enCours)

    return (
        <div className="flex flex-col gap-3">
            {onCreate && (
                <Button size="lg" className="h-14 text-base" onClick={onCreate}>
                    <Plus size={20} />
                    Nouvelle commande
                </Button>
            )}
            <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">{toutes ? "Toutes vos commandes" : "Vos commandes en cours"}</h2>
                {miennes.length > miennes.filter(enCours).length && (
                    <Button variant="ghost" size="sm" onClick={() => setToutes(!toutes)}>{toutes ? "En cours seulement" : "Voir tout"}</Button>
                )}
            </div>
            {visibles.length === 0
                ? <EmptyState icon={ShoppingCart} title="Aucune commande en cours" description="Passez une commande : des kilos par catégorie de vêtements." />
                : (
                    <ul className="flex flex-col gap-2">
                        {visibles.map((c) => <li key={c.id}><CommandeCard commande={c} onOpen={() => onOpen(c)} /></li>)}
                    </ul>
                )}
        </div>
    )
}
