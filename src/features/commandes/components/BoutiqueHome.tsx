import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { AlertTriangle, CheckCircle2, ChevronRight, PackageOpen, ScanLine, Truck } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { cn } from "@/shared/lib/utils"
import { useCommandeContext } from "@/features/commandes/hooks/context/CommandeContext"
import { formatKg } from "@/features/commandes/utils/commandeAvancement"
import type { CommandeBoutique, LivraisonBoutique } from "@/features/commandes/types/commande.types"
import { CommandeCard } from "./BoutiqueCommandes"
import { ProgressCount } from "./commandeUi"

interface BoutiqueHomeProps {
    boutiqueId: string
    onScan: () => void
    onReceive: (livraison: LivraisonBoutique) => void
    onOpenCommande: (commande: CommandeBoutique) => void
    onShowCommandes: () => void
}

const jour = (d: string | null) => (d ? format(new Date(d.length === 10 ? `${d}T12:00:00` : d), "EEEE d MMMM", { locale: fr }) : null)

/**
 * L'accueil de la boutique : CE QUI ARRIVE. Aujourd'hui la boutique sert
 * surtout à réceptionner — chaque livraison en route est une grande carte
 * avec son bouton « Réceptionner » ; puis les dernières réceptions (le
 * retour de ce qui a été fait), puis, en bas, le suivi des commandes.
 */
export function BoutiqueHome({ boutiqueId, onScan, onReceive, onOpenCommande, onShowCommandes }: BoutiqueHomeProps) {
    const { livraisons, commandes } = useCommandeContext()
    const siennes = livraisons.filter((l) => l.boutique_id === boutiqueId)
    const enRoute = siennes.filter((l) => l.statut === "expediee" || l.statut === "en_reception")
    const aVenir = siennes.filter((l) => l.statut === "planifiee" || l.statut === "preparation")
    const recues = siennes
        .filter((l) => l.statut === "receptionnee" || l.statut === "litige")
        .sort((a, b) => (b.receptionnee_at ?? "").localeCompare(a.receptionnee_at ?? ""))
        .slice(0, 3)
    const enCours = commandes.filter((c) => c.boutique_id === boutiqueId && (c.statut === "ouverte" || c.statut === "en_cours"))

    return (
        <div className="flex flex-col gap-6">
            <section className="flex flex-col gap-3">
                <h2 className="flex items-center gap-2 text-base font-bold">
                    <Truck size={18} className="text-chart-2" />
                    À recevoir
                    {enRoute.length > 0 && <span className="rounded-full bg-chart-2/15 px-2 text-sm tabular-nums text-chart-2">{enRoute.length}</span>}
                </h2>

                {enRoute.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-4 py-8 text-center">
                        <PackageOpen size={28} className="text-muted-foreground" />
                        <p className="font-medium">Rien en route pour l'instant</p>
                        <p className="text-sm text-muted-foreground">
                            {aVenir.length > 0
                                ? `${aVenir.length} livraison${aVenir.length > 1 ? "s" : ""} en préparation à l'entrepôt.`
                                : "Les livraisons apparaissent ici dès leur départ de l'entrepôt."}
                        </p>
                    </div>
                ) : enRoute.map((l) => (
                    <article key={l.id} className="flex flex-col gap-3 rounded-2xl border border-l-4 border-border border-l-chart-2 bg-card p-4 shadow-sm">
                        <div className="flex items-start gap-3">
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-chart-2/10 text-chart-2"><Truck size={22} /></span>
                            <div className="min-w-0 flex-1">
                                <p className="font-mono text-base font-bold">{l.code}</p>
                                <p className="text-sm text-muted-foreground">
                                    {l.nb_cartons} cartons · {formatKg(l.kg_prevu)}
                                    {l.statut === "expediee" && jour(l.date_livraison_prevue) && ` · prévue ${jour(l.date_livraison_prevue)}`}
                                </p>
                            </div>
                        </div>
                        {l.nb_recus > 0 && <ProgressCount done={l.nb_recus} total={l.nb_cartons} tone={l.nb_ecarts ? "warning" : "success"} />}
                        <Button size="lg" className="h-12 text-base" onClick={() => onReceive(l)}>
                            <ScanLine size={20} />
                            {l.nb_recus > 0 ? "Continuer la réception" : "Réceptionner"}
                        </Button>
                    </article>
                ))}

                <Button variant="outline" className="h-12" onClick={onScan}>
                    <ScanLine size={18} />
                    Scanner un carton directement
                </Button>
            </section>

            {recues.length > 0 && (
                <section className="flex flex-col gap-2">
                    <h2 className="text-sm font-semibold text-muted-foreground">Dernières réceptions</h2>
                    <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                        {recues.map((l) => {
                            const ok = l.statut === "receptionnee"
                            return (
                                <li key={l.id}>
                                    <button type="button" onClick={() => onReceive(l)}
                                        className="flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50">
                                        {ok ? <CheckCircle2 size={20} className="shrink-0 text-success" /> : <AlertTriangle size={20} className="shrink-0 text-warning" />}
                                        <span className="flex min-w-0 flex-1 flex-col">
                                            <span className="font-mono font-semibold">{l.code}</span>
                                            <span className={cn("text-xs", ok ? "text-muted-foreground" : "font-medium text-warning")}>
                                                {ok ? `Validée · ${formatKg(l.kg_recu)}` : `${l.nb_ecarts} écart${l.nb_ecarts > 1 ? "s" : ""} · ${formatKg(l.kg_ecart)}`}
                                            </span>
                                        </span>
                                        <ChevronRight size={16} className="shrink-0 text-muted-foreground" />
                                    </button>
                                </li>
                            )
                        })}
                    </ul>
                </section>
            )}

            <section className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-muted-foreground">Vos commandes en cours</h2>
                    <Button variant="ghost" size="sm" onClick={onShowCommandes}>Tout voir</Button>
                </div>
                {enCours.length === 0
                    ? <p className="rounded-xl border border-dashed border-border px-4 py-4 text-center text-sm text-muted-foreground">Aucune commande en cours.</p>
                    : enCours.slice(0, 2).map((c) => <CommandeCard key={c.id} commande={c} onOpen={() => onOpenCommande(c)} />)}
            </section>
        </div>
    )
}
