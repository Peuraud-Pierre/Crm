import { format } from "date-fns"
import {
    AlertTriangle, CalendarClock, ClipboardList, Eye, FileUp, Pencil, StickyNote,
} from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { InfoTooltip } from "@/shared/ui/molecules/info-tooltip"
import type { RecordColumn } from "@/shared/ui/organisms/record-table"
import { cn } from "@/shared/lib/utils"
import { PACKING_STATUS_CONFIG, PACKING_STATUS_DOT } from "@/features/stock/constants"
import type { ArrivageManuelRow } from "@/features/stock/types/arrivage-manuel.types"
import { parseDechargement, isArrivageInvoiceAlert } from "@/features/stock/utils/arrivageHelpers"
import { packingGap } from "@/features/stock/utils/packingGrouping"
import { ArrivageStatusBadge } from "./ArrivageStatusBadge"

/**
 * Les douze colonnes du tableau des arrivages.
 *
 * Elles portent tout le vocabulaire métier — `RecordTable` n'en connaît rien.
 * Les largeurs sont en pourcentage et supposent `table-layout: fixed` côté
 * table, sans quoi le navigateur les traiterait comme de simples suggestions.
 */

export function fmtDate(d: string | null | undefined): string {
    if (!d) return "—"
    try {
        // date-only strings (YYYY-MM-DD) must be parsed as local midnight, not UTC
        const date = d.length === 10 ? new Date(d + "T00:00") : new Date(d)
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
    onOpen: (row: ArrivageManuelRow) => void
    /** Ouvre directement le formulaire, sans passer par la fiche. */
    onEdit: (row: ArrivageManuelRow) => void
    /** Ids des 5 prochains arrivages par date de déchargement prévue. */
    upcomingIds: Set<string>
    /** `stock.packing.view` : ouvrir une packing existante. */
    canPackingView?: boolean
    /** `stock.packing.create` : importer une packing sur un arrivage qui n'en a pas. */
    canPackingCreate?: boolean
    /** Ouvre la sheet packing. Absent, aucune icône packing n'est rendue. */
    onPacking?: (row: ArrivageManuelRow) => void
}

export function buildArrivageColumns({
    canUpdate,
    onOpen,
    onEdit,
    upcomingIds,
    canPackingView = false,
    canPackingCreate = false,
    onPacking,
}: ColumnContext): readonly RecordColumn<ArrivageManuelRow>[] {
    /**
     * Icône packing à deux états : importer (pas de packing) ou ouvrir (packing
     * présente, pastille à la couleur de son statut).
     *
     * Une packing « à vérifier », en traitement ou en échec reste visible SANS
     * survol : c'est une action en attente, elle doit se repérer en parcourant
     * la colonne. Importer ou consulter une packing validée n'apparaît qu'au
     * survol, comme le crayon.
     *
     * `packing` indéfini = synthèses non chargées (migration absente, erreur) :
     * rien n'est rendu plutôt que de proposer un import peut-être en doublon.
     */
    const renderPackingButton = (row: ArrivageManuelRow) => {
        const packing = row.packing
        if (!onPacking || packing === undefined) return null
        if (packing === null ? !canPackingCreate : !canPackingView) return null

        const pending = packing !== null && packing.status !== "validee"
        const label = packing
            ? `Packing list de l'arrivage ${row.container_no} (${PACKING_STATUS_CONFIG[packing.status].label.toLowerCase()})`
            : `Importer la packing list de l'arrivage ${row.container_no}`

        return (
            <Button
                variant="ghost"
                size="icon"
                className={cn(
                    "relative h-6 w-6 transition-opacity focus-visible:opacity-100",
                    pending
                        ? "opacity-100"
                        : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100",
                )}
                onClick={(event) => {
                    // Même raison que le crayon : la ligne entière ouvre la fiche.
                    event.stopPropagation()
                    onPacking(row)
                }}
                aria-label={label}
                title={label}
            >
                {packing ? <ClipboardList size={12} aria-hidden /> : <FileUp size={12} aria-hidden />}
                {packing && (
                    <span
                        className={cn(
                            "absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full",
                            PACKING_STATUS_DOT[packing.status],
                        )}
                        aria-hidden
                    />
                )}
            </Button>
        )
    }

    return [
        {
            key: "status",
            header: "Statut",
            width: "8%",
            cell: (row) => <ArrivageStatusBadge status={row.status} auto={row.status_auto} />,
        },
        {
            key: "fournisseur",
            header: "Fournisseur",
            width: "16%",
            cell: (row) => (
                <div className="flex items-center gap-1.5 min-w-0">
                    <div className="min-w-0">
                        <div className="font-medium text-xs leading-tight truncate">
                            {row.fournisseur?.name ?? row.fournisseur_id ?? "—"}
                        </div>
                        {row.fournisseur?.siege_localisation && (
                            <div className="text-3xs text-muted-foreground leading-tight truncate">
                                {row.fournisseur.siege_localisation}
                            </div>
                        )}
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
            key: "facture",
            header: "Facture",
            width: "8%",
            // Alerte rouge si le déchargement est à J-7 ou moins sans facture.
            cellClassName: (row) =>
                cn(
                    "whitespace-nowrap",
                    isArrivageInvoiceAlert(row)
                        ? "text-red-600 dark:text-red-400"
                        : "text-slate-500 dark:text-slate-400",
                ),
            cell: (row) => (
                <span className="inline-flex items-center gap-1">
                    {isArrivageInvoiceAlert(row) && (
                        <AlertTriangle size={11} className="shrink-0" aria-label="Facture manquante" />
                    )}
                    {fmtDate(row.invoice_date)}
                </span>
            ),
        },
        {
            key: "depart",
            header: "Départ",
            width: "7%",
            cellClassName: "whitespace-nowrap",
            cell: (row) => fmtDate(row.departure_date),
        },
        {
            key: "havre",
            header: "Le Havre",
            width: "7%",
            cellClassName: "whitespace-nowrap",
            cell: (row) => fmtDate(row.port_arrival_date),
        },
        {
            key: "mode",
            header: "Mode",
            width: "7%",
            cellClassName: "whitespace-nowrap text-slate-600 dark:text-slate-300",
            cell: (row) => row.transport_mode ?? "—",
        },
        {
            key: "conteneur",
            header: "N° Conteneur",
            width: "13%",
            cellClassName: "font-mono whitespace-nowrap text-xs",
            cell: (row) => row.container_no,
        },
        {
            key: "dechargement",
            header: (
                <span className="inline-flex items-center gap-1">
                    <CalendarClock size={11} className="opacity-70" aria-hidden />
                    Déchargement
                </span>
            ),
            width: "14%",
            // Seule colonne mise en avant dans l'en-tête : c'est la date qui
            // pilote le surlignage des prochains arrivages.
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
            width: "7%",
            cellClassName: "text-right whitespace-nowrap tabular-nums",
            // Écart signalé seulement pour une packing VALIDÉE : avant
            // vérification, ses chiffres ne font pas encore foi. Et seulement
            // si la packing porte VRAIMENT un poids : la plupart des documents
            // du fournisseur ne comptent qu'en pièces, `weightKg` est alors
            // nul et une absence n'est pas un écart.
            cell: (row) => {
                const packing = row.packing
                const gap = packing?.status === "validee" ? packingGap(row, packing) : null
                if (!packing || !gap?.diverges || gap.weightKg === null) {
                    return fmtNum(row.total_weight_kg)
                }
                return (
                    <span className="inline-flex items-center justify-end gap-1">
                        <span className="text-warning">
                            <InfoTooltip
                                icon={AlertTriangle}
                                content={`Packing list : ${fmtNum(packing.total_weight_kg, " kg")}`}
                                size={11}
                                side="left"
                                className="shrink-0"
                            />
                        </span>
                        {fmtNum(row.total_weight_kg)}
                    </span>
                )
            },
        },
        {
            key: "qty",
            header: "Quantité",
            width: "6%",
            cellClassName: "text-right whitespace-nowrap tabular-nums",
            // La « Quantité » saisie est un nombre de COLIS : c'est ici que
            // l'écart avec une packing validée se lit, puisque le colis est la
            // seule grandeur que tout document du fournisseur porte.
            cell: (row) => {
                const packing = row.packing
                const gap = packing?.status === "validee" ? packingGap(row, packing) : null
                if (!packing || !gap?.diverges || gap.packages === null) {
                    return fmtNum(row.total_qty)
                }
                return (
                    <span className="inline-flex items-center justify-end gap-1">
                        <span className="text-warning">
                            <InfoTooltip
                                icon={AlertTriangle}
                                content={`Packing list : ${fmtNum(packing.total_packages)} colis`}
                                size={11}
                                side="left"
                                className="shrink-0"
                            />
                        </span>
                        {fmtNum(row.total_qty)}
                    </span>
                )
            },
        },
        {
            key: "interne",
            header: "N° Interne",
            width: "6%",
            cellClassName: "font-mono whitespace-nowrap text-3xs text-muted-foreground truncate",
            cell: (row) => row.conteneur_no_raw ?? "—",
        },
        {
            key: "actions",
            header: "",
            // Deux boutons : packing list et crayon (ou œil).
            width: "7%",
            cellClassName: "px-2 text-right",
            // Raccourci de la ligne. Le clic sur la ligne ouvre la fiche de
            // LECTURE ; ce bouton saute directement au formulaire pour qui peut
            // écrire — corriger un n° de conteneur ne vaut pas deux écrans.
            //
            // Il reste rendu SANS le droit de modification, en œil vers la
            // fiche : une ligne de tableau n'est pas focusable, ce bouton est
            // donc le seul point d'entrée accessible au clavier.
            cell: (row) => (
                <div className="flex items-center justify-end gap-0.5">
                {renderPackingButton(row)}
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 focus-visible:opacity-100 transition-opacity"
                    onClick={(event) => {
                        // La ligne entière est cliquable depuis l'ajout de la
                        // fiche de lecture : sans ça, le clic remonterait et
                        // ouvrirait aussi la fiche.
                        event.stopPropagation()
                        if (canUpdate) onEdit(row)
                        else onOpen(row)
                    }}
                    aria-label={
                        canUpdate
                            ? `Modifier l'arrivage ${row.container_no}`
                            : `Voir l'arrivage ${row.container_no}`
                    }
                >
                    {canUpdate ? (
                        <Pencil size={12} aria-hidden />
                    ) : (
                        <Eye size={12} aria-hidden />
                    )}
                </Button>
                </div>
            ),
        },
    ]
}
