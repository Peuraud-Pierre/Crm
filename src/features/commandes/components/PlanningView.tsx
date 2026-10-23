import { useMemo, useState } from "react"
import { format, isWeekend, parseISO } from "date-fns"
import { fr } from "date-fns/locale"
import { AlertTriangle, CalendarRange, ChevronLeft, ChevronRight, Scale, ShoppingCart, Target, Truck } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { StatTile } from "@/shared/components/misc/StatTile"
import { cn } from "@/shared/lib/utils"
import { GESTION_THEME } from "@/features/stock"
import { LIVRAISON_BOUTIQUE_STATUS_CONFIG } from "@/features/commandes/constants"
import { useCommandeContext } from "@/features/commandes/hooks/context/CommandeContext"
import { formatKg } from "@/features/commandes/utils/commandeAvancement"
import {
    buildPlanningRows, isEnRetard, planningDays, planningKpis, shiftAnchor, toDay, type PlanningEchelle,
} from "@/features/commandes/utils/planning"
import type { CommandeBoutique, LivraisonBoutique, LivraisonBoutiqueStatut } from "@/features/commandes/types/commande.types"
import { VueToggle } from "@/shared/ui/molecules/vue-toggle"

interface PlanningViewProps {
    onOpenLivraison: (l: LivraisonBoutique) => void
    onOpenCommande: (c: CommandeBoutique) => void
    /** Raccourcis du bandeau vers les listes filtrées. */
    onShowLivraisons: () => void
    onShowCommandes: () => void
}

const LEGENDE: LivraisonBoutiqueStatut[] = ["planifiee", "preparation", "expediee", "en_reception", "receptionnee", "litige"]

/**
 * Supervision : le bandeau dit ce qui demande attention (retards, litiges,
 * kilos en écart), la grille dit qui reçoit quoi et quand — une ligne par
 * boutique, une colonne par jour. Une livraison partie est placée à sa date
 * RÉELLE d'expédition, sinon à sa date prévue.
 */
export function PlanningView({ onOpenLivraison, onOpenCommande, onShowLivraisons, onShowCommandes }: PlanningViewProps) {
    const { boutiques, livraisons, commandes } = useCommandeContext()
    const [echelle, setEchelle] = useState<PlanningEchelle>("semaine")
    const [anchor, setAnchor] = useState(() => new Date())
    const today = toDay(new Date())

    const days = useMemo(() => planningDays(anchor, echelle), [anchor, echelle])
    const rows = useMemo(() => buildPlanningRows(boutiques, livraisons, commandes, days), [boutiques, livraisons, commandes, days])
    const kpis = useMemo(() => planningKpis(livraisons, commandes, today), [livraisons, commandes, today])

    const titre = echelle === "semaine"
        ? `Semaine du ${format(parseISO(days[0]), "d MMMM", { locale: fr })}`
        : format(anchor, "MMMM yyyy", { locale: fr })

    return (
        <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                <StatTile index={0} icon={ShoppingCart} label="Commandes en cours" value={kpis.commandesOuvertes} onClick={onShowCommandes} />
                <StatTile index={1} icon={Truck} label="Livraisons cette semaine" value={kpis.livraisonsSemaine} tone="primary" onClick={onShowLivraisons} />
                <StatTile index={2} icon={AlertTriangle} label="En retard" value={kpis.enRetard} tone={kpis.enRetard ? "warning" : undefined} onClick={onShowLivraisons} />
                <StatTile index={3} icon={Target} label="En litige" value={kpis.enLitige} tone={kpis.enLitige ? "destructive" : undefined} onClick={onShowLivraisons} />
                <StatTile index={4} icon={Scale} label="Kilos en écart" value={formatKg(kpis.kgEcart)} tone={kpis.kgEcart ? "destructive" : undefined} />
            </div>

            <div className={cn("flex flex-col gap-3 p-3 sm:p-4", GESTION_THEME.settings.content)}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                        <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Période précédente" onClick={() => setAnchor(shiftAnchor(anchor, echelle, -1))}>
                            <ChevronLeft size={16} />
                        </Button>
                        <Button variant="outline" size="sm" className="h-8" onClick={() => setAnchor(new Date())}>Aujourd'hui</Button>
                        <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Période suivante" onClick={() => setAnchor(shiftAnchor(anchor, echelle, 1))}>
                            <ChevronRight size={16} />
                        </Button>
                        <h3 className="ml-2 text-sm font-semibold capitalize">{titre}</h3>
                    </div>
                    <VueToggle
                        vues={[
                            { id: "semaine", label: "Semaine", icon: CalendarRange },
                            { id: "mois", label: "Mois", icon: CalendarRange },
                        ]}
                        value={echelle}
                        onChange={setEchelle}
                    />
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full min-w-max border-separate border-spacing-0 text-xs">
                        <thead>
                            <tr>
                                <th className="sticky left-0 z-10 w-36 bg-card px-2 py-1.5 text-left font-medium text-muted-foreground">Boutique</th>
                                {days.map((d) => {
                                    const date = parseISO(d)
                                    return (
                                        <th key={d} className={cn("px-1 py-1.5 text-center font-medium",
                                            d === today ? "text-primary" : "text-muted-foreground", isWeekend(date) && "bg-muted/30")}>
                                            <div className="capitalize">{format(date, echelle === "semaine" ? "EEE" : "EEEEE", { locale: fr })}</div>
                                            <div className={cn("tabular-nums", d === today && "font-bold")}>{format(date, "d")}</div>
                                        </th>
                                    )
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 && (
                                <tr><td colSpan={days.length + 1} className="px-2 py-6 text-center text-muted-foreground">Ajoutez des boutiques (vue « Boutiques ») pour remplir le planning.</td></tr>
                            )}
                            {rows.map((row) => (
                                <tr key={row.boutiqueId}>
                                    <td className="sticky left-0 z-10 border-t border-border bg-card px-2 py-1.5 font-medium">{row.boutiqueNom}</td>
                                    {days.map((d) => {
                                        const items = row.livraisons.get(d) ?? []
                                        const echeances = row.echeances.get(d) ?? []
                                        return (
                                            <td key={d} className={cn("h-12 border-t border-l border-border p-0.5 align-top",
                                                isWeekend(parseISO(d)) && "bg-muted/30", d === today && "bg-primary/5",
                                                echelle === "semaine" ? "min-w-24" : "min-w-10")}>
                                                <div className="flex flex-col gap-0.5">
                                                    {echeances.map((c) => (
                                                        <button key={c.id} type="button" onClick={() => onOpenCommande(c)} title={`${c.code} souhaitée ce jour`}
                                                            className="truncate rounded border border-dashed border-primary/60 px-1 text-left font-mono text-3xs text-primary hover:bg-primary/10">
                                                            ◆ {echelle === "semaine" ? c.code : ""}
                                                        </button>
                                                    ))}
                                                    {items.map((l) => <PlanningChip key={l.id} livraison={l} compact={echelle === "mois"} retard={isEnRetard(l, today)} onOpen={() => onOpenLivraison(l)} />)}
                                                </div>
                                            </td>
                                        )
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {LEGENDE.map((s) => (
                        <li key={s} className="inline-flex items-center gap-1.5">
                            <span className={cn("h-2 w-2 rounded-full", LIVRAISON_BOUTIQUE_STATUS_CONFIG[s].dot)} aria-hidden />
                            {LIVRAISON_BOUTIQUE_STATUS_CONFIG[s].label}
                        </li>
                    ))}
                    <li className="inline-flex items-center gap-1.5"><span className="font-mono text-primary">◆</span> Date souhaitée d'une commande</li>
                    <li className="inline-flex items-center gap-1.5"><AlertTriangle size={11} className="text-destructive" /> En retard</li>
                </ul>
            </div>
        </div>
    )
}

function PlanningChip({ livraison, compact, retard, onOpen }: { livraison: LivraisonBoutique; compact: boolean; retard: boolean; onOpen: () => void }) {
    const cfg = LIVRAISON_BOUTIQUE_STATUS_CONFIG[livraison.statut]
    return (
        <button
            type="button"
            onClick={onOpen}
            title={`${livraison.code} · ${cfg.label} · ${livraison.nb_cartons} cartons${retard ? " · EN RETARD" : ""}`}
            className={cn(
                "flex items-center gap-1 truncate rounded border px-1 py-0.5 text-left transition-colors hover:brightness-95",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                cfg.className,
                retard && "ring-1 ring-destructive",
            )}
        >
            <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", cfg.dot)} aria-hidden />
            {!compact && <span className="font-mono text-3xs font-semibold">{livraison.code.replace("LIV-", "")}</span>}
            {!compact && <span className="text-3xs tabular-nums opacity-80">{livraison.nb_cartons}c</span>}
            {retard && <AlertTriangle size={10} className="shrink-0 text-destructive" />}
        </button>
    )
}
