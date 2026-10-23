import { StatusBadge } from "@/shared/ui/molecules/status-badge"
import { RecordTable, type RecordColumn } from "@/shared/ui/organisms/record-table"
import { cn } from "@/shared/lib/utils"
import { HANDPICK_THEME } from "@/features/stock_handpick/theme"
import {
    BALLE_STATUS_CONFIG,
    QUANTITY_UNIT_LABELS,
    UUID_DISPLAY_LENGTH,
} from "@/features/stock_handpick/constants"
import type { BalleHandpick } from "@/features/stock_handpick/types/balle.types"
import { usineNameOf } from "@/features/stock_handpick/utils/balleDisplay"
import { Check, Lock } from "lucide-react"
import { isMovable } from "@/features/stock_handpick/hooks/ui/useBalleSelection"

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" })
const numberFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 })

interface BalleTableProps {
    balles: BalleHandpick[]
    /** Chemin lisible de l'emplacement, résolu par le contexte. */
    emplacementPath: (emplacementId: string | null | undefined) => string | null
    onRowClick: (balle: BalleHandpick) => void
    /** Mode sélection : ids cochés. Absent hors mode sélection. */
    selectedIds?: ReadonlySet<string>
}

/** Colonne de coche du mode sélection ; le clic se fait sur la ligne. */
function selectColumn(selectedIds: ReadonlySet<string>): RecordColumn<BalleHandpick> {
    return {
        key: "select",
        header: <span className="sr-only">Sélection</span>,
        headClassName: "w-10",
        cell: (balle) =>
            isMovable(balle) ? (
                <span
                    aria-label={selectedIds.has(balle.id) ? "Sélectionnée" : "Non sélectionnée"}
                    className={cn(
                        "flex h-5 w-5 items-center justify-center rounded border-2",
                        selectedIds.has(balle.id)
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border",
                    )}
                >
                    {selectedIds.has(balle.id) && <Check size={12} aria-hidden />}
                </span>
            ) : (
                <Lock size={13} className="text-muted-foreground" aria-label="Non déplaçable" />
            ),
    }
}

/**
 * Les colonnes dépendent du résolveur d'emplacement, qui vient du contexte :
 * elles se construisent donc par rendu plutôt qu'au niveau module.
 */
function buildColumns(
    emplacementPath: BalleTableProps["emplacementPath"],
): readonly RecordColumn<BalleHandpick>[] {
    return [
        {
            key: "ref",
            header: "Réf.",
            headClassName: "w-24",
            // Une balle n'a pas de code lisible : on montre le début de son
            // identifiant technique.
            cellClassName: HANDPICK_THEME.card.identity,
            cell: (balle) => balle.id.slice(0, UUID_DISPLAY_LENGTH),
        },
        {
            key: "libelle",
            header: "Libellé",
            cellClassName: "font-medium text-foreground",
            cell: (balle) => balle.raw_name ?? "Sans libellé",
        },
        {
            key: "fournisseur",
            header: "Usine",
            cell: (balle) => usineNameOf(balle) ?? "—",
        },
        {
            key: "categorie",
            header: "Catégorie",
            cell: (balle) => balle.category?.name ?? "—",
        },
        {
            key: "emplacement",
            header: "Emplacement",
            cell: (balle) =>
                balle.is_eclatee ? (
                    <span className="font-medium text-destructive">Éclatée</span>
                ) : balle.borrowed_by ? (
                    <span className="font-medium text-warning">Empruntée</span>
                ) : (
                    emplacementPath(balle.emplacement_id) ?? (
                        <span className={HANDPICK_THEME.card.emptyValue}>Non rangée</span>
                    )
                ),
        },
        {
            key: "quantite",
            header: "Quantité",
            headClassName: "w-28 text-right",
            cellClassName: cn("text-right", HANDPICK_THEME.flux.amount),
            cell: (balle) =>
                balle.packing !== null
                    ? `${numberFormatter.format(balle.packing)} ${
                          balle.packing_mode === "pieces"
                              ? QUANTITY_UNIT_LABELS.pieces
                              : QUANTITY_UNIT_LABELS.kg
                      }`
                    : "—",
        },
        {
            key: "entree",
            header: "Entrée",
            headClassName: "w-28",
            cellClassName: "tabular-nums",
            cell: (balle) =>
                balle.import_date ? dateFormatter.format(new Date(balle.import_date)) : "—",
        },
        {
            key: "statut",
            header: "Statut",
            headClassName: "w-32",
            cell: (balle) => <StatusBadge config={BALLE_STATUS_CONFIG[balle.status]} />,
        },
    ]
}

/**
 * Vue tableau de l'inventaire — l'alternative dense à la grille de cartes.
 *
 * L'inventaire n'en proposait aucune : le stock principal offre la bascule
 * Grille/Tableau depuis toujours, et se retrouver privé du tableau en passant
 * d'un stock à l'autre était l'un des écarts les plus visibles.
 *
 * Sous `md`, la table cède la place à la grille de cartes de l'onglet : pas de
 * `cardList` ici, les cartes existent déjà et en écrire une seconde variante
 * ferait diverger les deux rendus.
 */
export function BalleTable({ balles, emplacementPath, onRowClick, selectedIds }: BalleTableProps) {
    const columns = buildColumns(emplacementPath)
    return (
        <RecordTable
            columns={selectedIds ? [selectColumn(selectedIds), ...columns] : columns}
            rows={balles}
            rowKey={(balle) => balle.id}
            onRowClick={onRowClick}
            rowClassName={(balle) =>
                selectedIds?.has(balle.id) ? "bg-primary/10 hover:bg-primary/15" : undefined
            }
            wrapperClassName={HANDPICK_THEME.board.tableWrapper}
            headerRowClassName="hover:bg-transparent"
        />
    )
}
