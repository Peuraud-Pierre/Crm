import { format } from "date-fns"
import { CalendarClock, Eye, Pencil, StickyNote } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { InfoTooltip } from "@/shared/ui/molecules/info-tooltip"
import type { RecordColumn } from "@/shared/ui/organisms/record-table"
import { cn } from "@/shared/lib/utils"
import { parseDechargement } from "@/shared/lib/shipment"
import type { FluxHandpickRow } from "@/features/stock_handpick/types/flux.types"
import { FluxStatusBadge } from "./FluxStatusBadge"

/**
 * Colonnes du tableau des expéditions.
 *
 * Calquées sur celles du tableau des arrivages du stock principal — mêmes
 * intitulés, même ordre — pour qu'on puisse passer d'un stock à l'autre sans
 * réapprendre à lire. Facture, mode et conteneur n'y figurent pas :
 * `flux_handpick` ne les porte pas.
 *
 * Les largeurs sont en pourcentage, totalisent 100 % et supposent
 * `table-layout: fixed`. Les colonnes chiffrées alignent en-tête et valeurs à
 * droite.
 */

export function fmtDate(d: string | null | undefined): string {
    if (!d) return "—"
    try {
        // Une date seule (YYYY-MM-DD) se lit à minuit LOCAL, pas UTC : sinon
        // elle recule d'un jour à l'ouest de Greenwich.
        const date = d.length === 10 ? new Date(`${d}T00:00`) : new Date(d)
        return format(date, "dd/MM/yy")
    } catch {
        return d
    }
}

export function fmtNum(n: number | null | undefined, unit = ""): string {
    if (n == null) return "—"
    return `${n.toLocaleString("fr-FR")}${unit}`
}

interface ColumnContext {
    /** Droit de modification : décide de la destination du bouton d'action. */
    canUpdate: boolean
    /** Ouvre la fiche de lecture. */
    onOpen: (row: FluxHandpickRow) => void
    /** Ouvre directement le formulaire, sans passer par la fiche. */
    onEdit: (row: FluxHandpickRow) => void
    /** Ids des prochaines expéditions par date de déchargement prévue. */
    upcomingIds: Set<string>
}

export function buildFluxColumns({
    canUpdate,
    onOpen,
    onEdit,
    upcomingIds,
}: ColumnContext): readonly RecordColumn<FluxHandpickRow>[] {
    return [
        {
            key: "status",
            header: "Statut",
            width: "12%",
            cell: (row) => <FluxStatusBadge status={row.status} />,
        },
        {
            key: "fournisseur",
            header: "Usine",
            width: "24%",
            cell: (row) => (
                <div className="flex items-center gap-1.5 min-w-0">
                    <div className="min-w-0">
                        <div className="font-medium text-xs leading-tight truncate">
                            {row.fournisseur?.name ?? "—"}
                        </div>
                    </div>
                    {row.notes && (
                        <InfoTooltip
                            icon={StickyNote}
                            content={row.notes}
                            size={12}
                            side="right"
                            className="shrink-0"
                        />
                    )}
                </div>
            ),
        },
        {
            key: "type",
            header: "Type",
            width: "14%",
            cellClassName: "truncate text-slate-600 dark:text-slate-300",
            cell: (row) => row.type ?? "—",
        },
        {
            key: "depart",
            header: "Départ",
            width: "10%",
            cellClassName: "whitespace-nowrap",
            cell: (row) => fmtDate(row.departure_date),
        },
        {
            key: "dechargement",
            header: (
                <span className="inline-flex items-center gap-1">
                    <CalendarClock size={11} className="opacity-70" aria-hidden />
                    Déchargement
                </span>
            ),
            width: "18%",
            // Seule colonne mise en avant dans l'en-tête : c'est la date qui
            // pilote le surlignage des prochaines expéditions.
            headClassName: "text-foreground",
            cell: (row) => {
                const dechargement = parseDechargement(row.prev_dechargement_at)
                if (!dechargement) return <span className="text-muted-foreground">—</span>
                const isNext = upcomingIds.has(row.id)
                return (
                    <div className="flex flex-col leading-tight">
                        <span
                            className={cn(
                                "capitalize font-medium",
                                isNext
                                    ? "text-amber-700 dark:text-amber-400"
                                    : "text-slate-600 dark:text-slate-300",
                            )}
                        >
                            {dechargement.jour}
                        </span>
                        <span
                            className={cn(
                                "text-3xs leading-tight tabular-nums",
                                isNext
                                    ? "text-amber-600/80 dark:text-amber-500/70"
                                    : "text-muted-foreground",
                            )}
                        >
                            {dechargement.date} · {dechargement.heure}
                        </span>
                    </div>
                )
            },
        },
        {
            key: "poids",
            header: "Poids (kg)",
            width: "10%",
            headClassName: "text-right",
            cellClassName: "text-right whitespace-nowrap tabular-nums",
            // Poids saisi, à défaut total des lignes en kg.
            cell: (row) => (row.total_weight_kg > 0 ? fmtNum(row.total_weight_kg) : "—"),
        },
        {
            key: "qty",
            header: "Quantité",
            width: "8%",
            headClassName: "text-right",
            cellClassName: "text-right whitespace-nowrap tabular-nums",
            cell: (row) => (row.total_qty > 0 ? fmtNum(row.total_qty) : "—"),
        },
        {
            key: "actions",
            header: "",
            width: "4%",
            cellClassName: "px-2 text-right",
            // Raccourci de la ligne. Le clic sur la ligne ouvre la fiche de
            // LECTURE ; ce bouton saute directement au formulaire pour qui peut
            // écrire — corriger une date ne vaut pas deux écrans.
            //
            // Il reste rendu SANS le droit de modification, en œil vers la
            // fiche : une ligne de tableau n'est pas focusable, ce bouton est
            // donc le seul point d'entrée accessible au clavier, et c'est par
            // la fiche que se consulte la liste de colisage.
            cell: (row) => {
                const label = row.fournisseur?.name ?? ""
                return (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 focus-visible:opacity-100 transition-opacity"
                        onClick={(event) => {
                            // La ligne entière est cliquable : sans ça, le clic
                            // remonterait et ouvrirait aussi la fiche.
                            event.stopPropagation()
                            if (canUpdate) onEdit(row)
                            else onOpen(row)
                        }}
                        aria-label={
                            canUpdate
                                ? `Modifier l'expédition ${label}`.trim()
                                : `Voir l'expédition ${label}`.trim()
                        }
                    >
                        {canUpdate ? (
                            <Pencil size={12} aria-hidden />
                        ) : (
                            <Eye size={12} aria-hidden />
                        )}
                    </Button>
                )
            },
        },
    ]
}
