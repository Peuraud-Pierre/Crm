import { useMemo, type ReactNode } from "react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import {
    AlertTriangle, ArrowRight, CheckCircle2, Inbox, PackageOpen, Plus, Scale, Truck, type LucideIcon,
} from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { cn } from "@/shared/lib/utils"
import { useCommandeContext } from "@/features/commandes/hooks/context/CommandeContext"
import { formatKg } from "@/features/commandes/utils/commandeAvancement"
import { fileDeTravail, type Etape } from "@/features/commandes/utils/fileDeTravail"
import { isEnRetard, toDay } from "@/features/commandes/utils/planning"
import type { CommandeBoutique, LivraisonBoutique } from "@/features/commandes/types/commande.types"
import { ProgressCount } from "./commandeUi"

interface FileDeTravailViewProps {
    onSaisir?: () => void
    onPreparer: (commande: CommandeBoutique) => void
    onOpenCommande: (commande: CommandeBoutique) => void
    onOpenLivraison: (livraison: LivraisonBoutique) => void
    /** Ouvre la réception (espace boutique) ; absent sans le droit boutique. */
    onReceptionner?: (livraison: LivraisonBoutique) => void
    /** Écriture en cours (préparation lancée) : boutons d'action figés. */
    busy?: boolean
}

/** Habillage de chaque étape : tokens d'état, jamais de couleur en dur. */
const ETAPE: Record<Etape, { titre: string; aide: string; icon: LucideIcon; pastille: string; bord: string; vide: string }> = {
    a_preparer:  { titre: "À préparer",     aide: "Commandes reçues, rien en préparation",  icon: Inbox,         pastille: "bg-primary/10 text-primary",         bord: "border-l-primary",     vide: "Aucune commande en attente." },
    preparation: { titre: "En préparation", aide: "Cartons, étiquettes, puis expédition",    icon: PackageOpen,   pastille: "bg-chart-4/10 text-chart-4",         bord: "border-l-chart-4",     vide: "Rien sur le quai." },
    en_route:    { titre: "En route",       aide: "La boutique scanne à l'arrivée",          icon: Truck,         pastille: "bg-chart-2/10 text-chart-2",         bord: "border-l-chart-2",     vide: "Aucune livraison en route." },
    a_regler:    { titre: "À régler",       aide: "Écarts constatés à la réception",         icon: AlertTriangle, pastille: "bg-destructive/10 text-destructive", bord: "border-l-destructive", vide: "Aucun litige." },
}

const jour = (d: string | null) => (d ? format(new Date(d.length === 10 ? `${d}T12:00:00` : d), "EEE d MMM", { locale: fr }) : null)

/**
 * L'accueil de l'entrepôt : CE QU'IL Y A À FAIRE, étape par étape. Chaque
 * carte porte son action suivante ; le point d'entrée du circuit (une
 * commande reçue par mail) est le premier bouton de l'écran.
 */
export function FileDeTravailView({ onSaisir, onPreparer, onOpenCommande, onOpenLivraison, onReceptionner, busy }: FileDeTravailViewProps) {
    const { commandes, livraisons, loading } = useCommandeContext()
    const today = toDay(new Date())
    const file = useMemo(() => fileDeTravail(commandes, livraisons, today), [commandes, livraisons, today])
    const total = file.a_preparer.length + file.preparation.length + file.en_route.length + file.a_regler.length

    return (
        <div className="flex flex-col gap-4">
            {onSaisir && (
                <div className="flex flex-col gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Inbox size={22} /></span>
                    <div className="min-w-0 flex-1">
                        <p className="font-semibold">Une commande vient d'arriver ?</p>
                        <p className="text-sm text-muted-foreground">Saisissez-la : boutique, catégories, kilos. Elle rejoint « À préparer ».</p>
                    </div>
                    <Button size="lg" className="h-11" onClick={onSaisir}>
                        <Plus size={18} />
                        Saisir une commande
                    </Button>
                </div>
            )}

            {!loading && total === 0 && (
                <p className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-success/40 bg-success/5 px-4 py-6 text-sm font-medium text-success">
                    <CheckCircle2 size={18} />
                    Tout est à jour : rien à préparer, rien en route, aucun litige.
                </p>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Colonne etape="a_preparer" count={file.a_preparer.length}>
                    {file.a_preparer.map((c) => (
                        <Carte key={c.id} etape="a_preparer" onOpen={() => onOpenCommande(c)}
                            titre={c.code} sous={c.boutique_nom}
                            ligne={<><span className="font-semibold tabular-nums">{formatKg(c.kg_reste)}</span> à servir · {c.nb_lignes} catégorie{c.nb_lignes > 1 ? "s" : ""}</>}
                            meta={c.date_souhaitee ? `Pour le ${jour(c.date_souhaitee)}` : undefined}
                            action={{ label: c.nb_livraisons > 0 ? "Préparer la suite" : "Préparer", onClick: () => onPreparer(c), disabled: busy }} />
                    ))}
                </Colonne>
                <Colonne etape="preparation" count={file.preparation.length}>
                    {file.preparation.map((l) => (
                        <Carte key={l.id} etape="preparation" onOpen={() => onOpenLivraison(l)} retard={isEnRetard(l, today)}
                            titre={l.code} sous={`${l.boutique_nom}${l.commande_code ? ` · ${l.commande_code}` : ""}`}
                            ligne={l.nb_cartons === 0
                                ? <span className="text-muted-foreground">Aucun carton encore</span>
                                : <><span className="font-semibold tabular-nums">{l.nb_cartons} carton{l.nb_cartons > 1 ? "s" : ""}</span> · {formatKg(l.kg_prevu)}</>}
                            meta={l.date_expedition_prevue ? `Départ ${jour(l.date_expedition_prevue)}` : undefined}
                            action={{ label: l.nb_cartons === 0 ? "Remplir" : "Continuer", onClick: () => onOpenLivraison(l) }} />
                    ))}
                </Colonne>
                <Colonne etape="en_route" count={file.en_route.length}>
                    {file.en_route.map((l) => (
                        <Carte key={l.id} etape="en_route" onOpen={() => onOpenLivraison(l)} retard={isEnRetard(l, today)}
                            titre={l.code} sous={l.boutique_nom}
                            ligne={<ProgressCount done={l.nb_recus} total={l.nb_cartons} tone={l.nb_ecarts ? "warning" : "success"} />}
                            meta={l.statut === "en_reception" ? "Réception en cours" : l.date_livraison_prevue ? `Arrivée ${jour(l.date_livraison_prevue)}` : "Expédiée"}
                            action={onReceptionner
                                ? { label: "Réceptionner", onClick: () => onReceptionner(l), variant: "outline" }
                                : { label: "Suivre", onClick: () => onOpenLivraison(l), variant: "ghost" }} />
                    ))}
                </Colonne>
                <Colonne etape="a_regler" count={file.a_regler.length}>
                    {file.a_regler.map((l) => (
                        <Carte key={l.id} etape="a_regler" onOpen={() => onOpenLivraison(l)}
                            titre={l.code} sous={l.boutique_nom}
                            ligne={<span className="inline-flex items-center gap-1.5 font-semibold text-destructive"><Scale size={14} />{formatKg(l.kg_ecart)} en écart · {l.nb_ecarts} carton{l.nb_ecarts > 1 ? "s" : ""}</span>}
                            action={{ label: "Voir les écarts", onClick: () => onOpenLivraison(l), variant: "outline" }} />
                    ))}
                </Colonne>
            </div>
        </div>
    )
}

function Colonne({ etape, count, children }: { etape: Etape; count: number; children: ReactNode }) {
    const e = ETAPE[etape]
    return (
        <section className="flex min-w-0 flex-col gap-2 rounded-2xl bg-muted/40 p-2.5" aria-label={e.titre}>
            <header className="flex items-center gap-2.5 px-1 py-1">
                <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", e.pastille)}><e.icon size={18} /></span>
                <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold">{e.titre}</h3>
                    <p className="truncate text-xs text-muted-foreground">{e.aide}</p>
                </div>
                <span className={cn("rounded-full px-2.5 py-0.5 text-sm font-bold tabular-nums", count ? e.pastille : "text-muted-foreground")}>{count}</span>
            </header>
            {count === 0
                ? <p className="rounded-xl border border-dashed border-border px-3 py-5 text-center text-xs text-muted-foreground">{e.vide}</p>
                : <ul className="flex flex-col gap-2">{children}</ul>}
        </section>
    )
}

interface CarteProps {
    etape: Etape
    titre: string
    sous: string
    ligne: ReactNode
    meta?: string
    retard?: boolean
    onOpen: () => void
    action: { label: string; onClick: () => void; variant?: "default" | "outline" | "ghost"; disabled?: boolean }
}

function Carte({ etape, titre, sous, ligne, meta, retard, onOpen, action }: CarteProps) {
    return (
        <li className={cn(
            "flex flex-col gap-2 rounded-xl border border-l-4 border-border bg-card p-3 shadow-sm transition-shadow hover:shadow-md",
            ETAPE[etape].bord,
        )}>
            <button type="button" onClick={onOpen} className="flex flex-col gap-0.5 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
                <span className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold">{titre}</span>
                    {retard && <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 text-xs font-semibold text-destructive"><AlertTriangle size={11} />Retard</span>}
                </span>
                <span className="truncate text-sm font-medium">{sous}</span>
            </button>
            <div className="text-sm">{ligne}</div>
            <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs text-muted-foreground">{meta}</span>
                <Button size="sm" variant={action.variant ?? "default"} className="h-9 shrink-0" onClick={action.onClick} disabled={action.disabled}>
                    {action.label}
                    <ArrowRight size={14} />
                </Button>
            </div>
        </li>
    )
}
