import {
    Box, Boxes, Calendar,
    MapPin, Package, Pencil, Scale, StickyNote, Tag,
} from "lucide-react"
import { DetailRow, DetailSheet, InfoTile } from "@/shared/ui/organisms/detail-sheet"
import { RecordTable, type RecordColumn } from "@/shared/ui/organisms/record-table"
import { StatusBadge } from "@/shared/ui/molecules/status-badge"
import { Button } from "@/shared/ui/atoms/button"
import { Separator } from "@/shared/ui/atoms/separator"
import { cn } from "@/shared/lib/utils"
import { HANDPICK_THEME } from "@/features/stock_handpick/theme"
import {
    BALLE_LOCATION_LABELS,
    BALLE_STATUS_CONFIG,
    QUANTITY_UNIT_LABELS,
    UUID_DISPLAY_LENGTH,
} from "@/features/stock_handpick/constants"
import type { BalleHandpick } from "@/features/stock_handpick/types/balle.types"
import { BalleEmplacementSection } from "./BalleEmplacementSection"
import { usineNameOf } from "@/features/stock_handpick/utils/balleDisplay"

const numberFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 })

const EMPTY = "—"

/** Surface d'une ligne libellé / valeur. */
const ROW = HANDPICK_THEME.settings.section.row

interface BalleDetailSheetProps {
    open: boolean
    balle: BalleHandpick | null
    emplacementPath: (emplacementId: string | null | undefined) => string | null
    onClose: () => void
    /** Absent quand l'utilisateur n'a que le droit de lecture. */
    onEdit?: () => void
    /** Droit d'emprunter et de rendre la balle (`inventaire.update`). */
    canBorrow: boolean
    /** Fait briller la balle dans le plan 3D — navigation inter-onglets. */
    onLocate: (balleId: string) => void
}

/**
 * Fiche de CONSULTATION d'une balle — le pendant lecture du formulaire
 * (`BalleSheet`). Elle reprend le dessin de la fiche du stock principal, sur la
 * coque partagée `shared/ui/organisms/detail-sheet`.
 *
 * Deux écarts assumés avec son aînée :
 *
 *  • pas de section « Rentabilité » : elle repose sur `unit_price`, retiré des
 *    catégories handpick. La rétablir demanderait une migration.
 *  • pas de ligne « Livraison » : ce module n'a pas d'entité livraison. Elle est
 *    remplacée par l'emplacement, que le stock principal n'a pas.
 *  • pas de section « Traçabilité » (balle parente, expéditions, balles
 *    enfants) : retirée à la demande du métier.
 */
export function BalleDetailSheet({
    open,
    balle,
    emplacementPath,
    onClose,
    onEdit,
    canBorrow,
    onLocate,
}: BalleDetailSheetProps) {
    if (!balle) return null

    const status = BALLE_STATUS_CONFIG[balle.status]
    const unit =
        balle.packing_mode === "pieces"
            ? QUANTITY_UNIT_LABELS.pieces
            : QUANTITY_UNIT_LABELS.kg

    const quantity = balle.packing !== null ? numberFormatter.format(balle.packing) : EMPTY
    const categoryName = balle.category?.name ?? EMPTY
    const fournisseurName = usineNameOf(balle) ?? EMPTY
    const place = emplacementPath(balle.emplacement_id)
    const locationLabel = balle.location ? BALLE_LOCATION_LABELS[balle.location] : null

    const importDate = balle.import_date
        ? new Date(balle.import_date).toLocaleDateString("fr-FR", {
              day: "2-digit",
              month: "long",
              year: "numeric",
          })
        : EMPTY

    const canLocate = Boolean(balle.emplacement_id) && !balle.borrowed_by && !balle.is_eclatee

    return (
        <DetailSheet
            open={open}
            onOpenChange={(value) => {
                if (!value) onClose()
            }}
            icon={Boxes}
            title={balle.raw_name ?? "Sans libellé"}
            subtitle={
                <>
                    <Calendar size={11} className="shrink-0" />
                    <span className="truncate">{importDate}</span>
                    <span className={cn("truncate", HANDPICK_THEME.card.identity)}>
                        {balle.id.slice(0, UUID_DISPLAY_LENGTH)}
                    </span>
                </>
            }
            badge={<StatusBadge config={status} />}
            footer={
                canLocate || onEdit ? (
                    <>
                        {/* Seule une balle rangée a un endroit à montrer. */}
                        {canLocate && (
                            <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 gap-1.5 text-xs sm:text-sm"
                                onClick={() => onLocate(balle.id)}
                            >
                                <Box size={13} />
                                <span>Plan 3D</span>
                            </Button>
                        )}
                        {onEdit && (
                            <Button size="sm" className="flex-1 gap-1.5 text-xs sm:text-sm" onClick={onEdit}>
                                <Pencil size={13} />
                                <span>Modifier</span>
                            </Button>
                        )}
                    </>
                ) : undefined
            }
        >
            {/* ── Section 1 : Informations ── */}
            <section className="space-y-3">
                <h3 className={HANDPICK_THEME.section.groupTitle}>Informations</h3>

                <div className="grid grid-cols-3 gap-2">
                    <InfoTile icon={<Scale size={12} />} label="Quantité">
                        <span className="text-2xl font-black tracking-tighter text-foreground">
                            {quantity}
                        </span>
                        <span className="text-xs font-medium text-muted-foreground">{unit}</span>
                    </InfoTile>

                    <InfoTile icon={<Tag size={12} />} label="Catégorie">
                        <span className="text-sm font-bold leading-tight text-foreground line-clamp-2">
                            {categoryName}
                        </span>
                    </InfoTile>

                    <InfoTile icon={<Package size={12} />} label="Usine">
                        <span className="text-sm font-bold leading-tight text-foreground line-clamp-1">
                            {fournisseurName}
                        </span>
                    </InfoTile>
                </div>

                <div className="space-y-2">
                    <DetailRow
                        icon={<MapPin size={14} className="text-muted-foreground" />}
                        label="Emplacement"
                        rowClassName={ROW}
                    >
                        {balle.is_eclatee ? (
                            <span className="text-sm font-semibold text-destructive">Éclatée</span>
                        ) : balle.borrowed_by ? (
                            <span className="text-sm font-semibold text-warning">Empruntée</span>
                        ) : place ? (
                            <span className="font-mono text-sm font-bold text-foreground">{place}</span>
                        ) : (
                            <span className={cn("text-xs", HANDPICK_THEME.card.emptyValue)}>
                                {locationLabel ?? "Non rangée"}
                            </span>
                        )}
                    </DetailRow>

                    {balle.notes && (
                        <DetailRow
                            icon={<StickyNote size={14} className="text-muted-foreground" />}
                            label="Notes"
                            rowClassName={ROW}
                        >
                            <span className="max-w-xs text-right text-sm text-muted-foreground">
                                {balle.notes}
                            </span>
                        </DetailRow>
                    )}
                </div>
            </section>

            {/* Emprunt et historique : composant à part, il porte des hooks. */}
            <BalleEmplacementSection balle={balle} canBorrow={canBorrow} />

            <Separator />

            {/* ── Section 2 : Données brutes ── */}
            <section className="space-y-3">
                <h3 className={HANDPICK_THEME.section.groupTitle}>Données brutes</h3>
                <RecordTable
                    columns={RAW_COLUMNS}
                    rows={[balle]}
                    rowKey={(row) => row.id}
                    wrapperClassName="overflow-hidden rounded-xl border border-border"
                    tableClassName="text-xs"
                    headerRowClassName="hover:bg-transparent"
                />
            </section>
        </DetailSheet>
    )
}

function quantityOf(balle: BalleHandpick): string {
    if (balle.packing === null) return EMPTY
    const unit =
        balle.packing_mode === "pieces"
            ? QUANTITY_UNIT_LABELS.pieces
            : QUANTITY_UNIT_LABELS.kg
    return `${numberFormatter.format(balle.packing)} ${unit}`
}

const RAW_COLUMNS: readonly RecordColumn<BalleHandpick>[] = [
    {
        key: "date",
        header: "Date",
        cellClassName: "tabular-nums",
        cell: (row) =>
            row.import_date ? new Date(row.import_date).toLocaleDateString("fr-FR") : EMPTY,
    },
    {
        key: "quantite",
        header: "Quantité",
        cellClassName: HANDPICK_THEME.flux.amount,
        cell: quantityOf,
    },
    {
        key: "fournisseur",
        header: "Usine",
        cell: (row) => usineNameOf(row) ?? EMPTY,
    },
    {
        key: "categorie",
        header: "Catégorie",
        cell: (row) => row.category?.name ?? EMPTY,
    },
    {
        key: "provenance",
        header: "Pays",
        cell: (row) => row.provenance ?? EMPTY,
    },
]
