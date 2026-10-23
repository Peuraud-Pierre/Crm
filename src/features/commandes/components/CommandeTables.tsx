import { useMemo, useState } from "react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { AlertTriangle, Container, Store } from "lucide-react"
import { RecordTable, type RecordColumn } from "@/shared/ui/organisms/record-table"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import { SkeletonTable } from "@/shared/ui/molecules/skeleton-presets"
import { cn } from "@/shared/lib/utils"
import { GESTION_THEME } from "@/features/stock"
import { useCommandeContext } from "@/features/commandes/hooks/context/CommandeContext"
import { formatKg, pourcentageRecu } from "@/features/commandes/utils/commandeAvancement"
import { isEnRetard, livraisonPlanningDay, toDay } from "@/features/commandes/utils/planning"
import type { CommandeBoutique, CommandeStatut, LivraisonBoutique, LivraisonBoutiqueStatut } from "@/features/commandes/types/commande.types"
import { AvancementBar, CommandeBadge, LivraisonBadge, ProgressCount } from "./commandeUi"

const TABLE_PROPS = {
    fixedLayout: true,
    tableClassName: "text-sm",
    wrapperClassName: "hidden overflow-x-auto rounded-xl border border-border md:block",
    headerRowClassName: "bg-muted/40 border-border hover:bg-muted/40",
    headCellClassName: "h-auto px-3 py-2.5 text-xs font-medium whitespace-nowrap text-muted-foreground",
    bodyCellClassName: "px-3 py-2.5",
    cardList: GESTION_THEME.board.cardList,
} as const

const kg = (v: number) => `${v.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} kg`
const day = (d: string | null) => (d ? format(new Date(d.length === 10 ? `${d}T12:00:00` : d), "d MMM", { locale: fr }) : "—")

/** Filtre par statut : « actives » par défaut — on travaille sur ce qui bouge. */
function StatutFilter<S extends string>({ value, onChange, options }: {
    value: S | "actives" | "toutes"
    onChange: (v: S | "actives" | "toutes") => void
    options: readonly { id: S | "actives" | "toutes"; label: string }[]
}) {
    return (
        <div className="flex flex-wrap gap-1">
            {options.map((o) => (
                <button key={o.id} type="button" onClick={() => onChange(o.id)} aria-pressed={value === o.id}
                    className={cn("h-8 rounded-md border px-2.5 text-xs font-semibold transition-colors",
                        value === o.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:text-foreground")}>
                    {o.label}
                </button>
            ))}
        </div>
    )
}

// ── Commandes ────────────────────────────────────────────────────────────────

const COMMANDE_FILTRES: { id: CommandeStatut | "actives" | "toutes"; label: string }[] = [
    { id: "actives", label: "En cours" },
    { id: "soldee", label: "Soldées" },
    { id: "annulee", label: "Annulées" },
    { id: "toutes", label: "Toutes" },
]

export function CommandesTable({ onOpen, onCreate }: { onOpen: (c: CommandeBoutique) => void; onCreate?: () => void }) {
    const { commandes, loading } = useCommandeContext()
    const [filtre, setFiltre] = useState<CommandeStatut | "actives" | "toutes">("actives")

    const rows = useMemo(() => commandes.filter((c) =>
        filtre === "toutes" ? true : filtre === "actives" ? c.statut === "ouverte" || c.statut === "en_cours" : c.statut === filtre), [commandes, filtre])

    const columns: RecordColumn<CommandeBoutique>[] = [
        { key: "code", header: "Commande", width: "7rem", cardPrimary: true, cell: (c) => <span className="font-mono font-semibold">{c.code}</span> },
        { key: "boutique", header: "Boutique", width: "18%", cardLabel: "Boutique", cell: (c) => <span className="font-medium">{c.boutique_nom}</span> },
        { key: "statut", header: "Statut", width: "8rem", cardTrailing: true, cell: (c) => <CommandeBadge statut={c.statut} /> },
        {
            key: "avancement", header: "Avancement", cardLabel: "Avancement",
            cell: (c) => (
                <div className="flex items-center gap-2">
                    <AvancementBar className="min-w-24" ligne={{ kg_demande: c.kg_demande, kg_recu: c.kg_recu, kg_expedie: c.kg_expedie, kg_prepare: c.kg_prepare, kg_manquant: 0, kg_reste: c.kg_reste }} />
                    <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{Math.round(pourcentageRecu(c))} %</span>
                </div>
            ),
        },
        { key: "kg", header: "Demandé", width: "6.5rem", headClassName: "text-right", cellClassName: "text-right", cardLabel: "Demandé", cell: (c) => <span className="tabular-nums">{kg(c.kg_demande)}</span> },
        { key: "livraisons", header: "Livr.", width: "4rem", headClassName: "text-right", cellClassName: "text-right", cardLabel: "Livraisons", cell: (c) => <span className="tabular-nums">{c.nb_livraisons}</span> },
        { key: "date", header: "Souhaitée", width: "6.5rem", cardLabel: "Souhaitée le", cell: (c) => <span className="text-muted-foreground">{day(c.date_souhaitee)}</span> },
    ]

    if (loading) return <SkeletonTable />
    return (
        <div className="flex flex-col gap-3">
            <StatutFilter value={filtre} onChange={setFiltre} options={COMMANDE_FILTRES} />
            {rows.length === 0
                ? <EmptyState icon={Store} title="Aucune commande" description="Aucune commande boutique dans ce filtre."
                    action={onCreate ? { label: "Nouvelle commande", onClick: onCreate } : undefined} className={GESTION_THEME.board.emptyState} />
                : <RecordTable {...TABLE_PROPS} columns={columns} rows={rows} rowKey={(c) => c.id} onRowClick={onOpen}
                    rowClassName={() => "border-b border-border last:border-b-0 hover:bg-muted/30"} />}
        </div>
    )
}

// ── Livraisons ───────────────────────────────────────────────────────────────

const LIVRAISON_FILTRES: { id: LivraisonBoutiqueStatut | "actives" | "toutes"; label: string }[] = [
    { id: "actives", label: "En cours" },
    { id: "litige", label: "Litiges" },
    { id: "receptionnee", label: "Réceptionnées" },
    { id: "toutes", label: "Toutes" },
]

export function LivraisonsTable({ onOpen, onCreate }: { onOpen: (l: LivraisonBoutique) => void; onCreate?: () => void }) {
    const { livraisons, loading } = useCommandeContext()
    const [filtre, setFiltre] = useState<LivraisonBoutiqueStatut | "actives" | "toutes">("actives")
    const today = toDay(new Date())

    const rows = useMemo(() => livraisons.filter((l) =>
        filtre === "toutes" ? true
            : filtre === "actives" ? ["planifiee", "preparation", "expediee", "en_reception"].includes(l.statut)
                : l.statut === filtre), [livraisons, filtre])

    const columns: RecordColumn<LivraisonBoutique>[] = [
        { key: "code", header: "Livraison", width: "7rem", cardPrimary: true, cell: (l) => <span className="font-mono font-semibold">{l.code}</span> },
        { key: "boutique", header: "Boutique", width: "16%", cardLabel: "Boutique", cell: (l) => <span className="font-medium">{l.boutique_nom}</span> },
        { key: "commande", header: "Commande", width: "7rem", cardLabel: "Commande", cardOmitWhen: (l) => !l.commande_code, cell: (l) => <span className="font-mono text-xs text-muted-foreground">{l.commande_code ?? "—"}</span> },
        { key: "statut", header: "Statut", width: "9rem", cardTrailing: true, cell: (l) => <LivraisonBadge statut={l.statut} /> },
        {
            key: "date", header: "Expédition", width: "8rem", cardLabel: "Expédition",
            cell: (l) => {
                const retard = isEnRetard(l, today)
                return (
                    <span className={cn("inline-flex items-center gap-1", retard ? "font-semibold text-destructive" : "text-muted-foreground")}>
                        {retard && <AlertTriangle size={12} aria-label="En retard" />}
                        {day(livraisonPlanningDay(l))}{!l.expediee_at && l.date_expedition_prevue && <span className="text-xs font-normal"> prévue</span>}
                    </span>
                )
            },
        },
        { key: "contenu", header: "Contenu", width: "9rem", cardLabel: "Contenu", cell: (l) => <span className="tabular-nums text-muted-foreground">{l.nb_cartons} cartons · {kg(l.kg_prevu)}</span> },
        {
            key: "reception", header: "Réception", cardLabel: "Réception",
            cardOmitWhen: (l) => l.statut === "planifiee" || l.statut === "preparation",
            cell: (l) => (l.statut === "planifiee" || l.statut === "preparation" || l.statut === "annulee")
                ? <span className="text-xs text-muted-foreground">—</span>
                : (
                    <div className="flex flex-col gap-0.5">
                        <ProgressCount done={l.nb_recus} total={l.nb_cartons} tone={l.nb_ecarts > 0 ? "warning" : "success"} />
                        {l.kg_ecart > 0 && <span className="text-xs font-semibold text-destructive">{l.nb_ecarts} écart(s) · {formatKg(l.kg_ecart)}</span>}
                    </div>
                ),
        },
    ]

    if (loading) return <SkeletonTable />
    return (
        <div className="flex flex-col gap-3">
            <StatutFilter value={filtre} onChange={setFiltre} options={LIVRAISON_FILTRES} />
            {rows.length === 0
                ? <EmptyState icon={Container} title="Aucune livraison" description="Aucune livraison boutique dans ce filtre."
                    action={onCreate ? { label: "Nouvelle livraison", onClick: onCreate } : undefined} className={GESTION_THEME.board.emptyState} />
                : <RecordTable {...TABLE_PROPS} columns={columns} rows={rows} rowKey={(l) => l.id} onRowClick={onOpen}
                    rowClassName={(l) => cn("border-b border-border last:border-b-0 hover:bg-muted/30", l.statut === "litige" && "bg-destructive/5", l.statut === "annulee" && "opacity-60")} />}
        </div>
    )
}
