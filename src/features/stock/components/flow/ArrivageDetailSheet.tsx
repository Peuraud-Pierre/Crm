import {
    Building2, CalendarClock, Hash, Package,
    Pencil, Scale, Ship, StickyNote, Truck,
} from "lucide-react"
import { DetailRow, DetailSheet, InfoTile } from "@/shared/ui/organisms/detail-sheet"
import { Button } from "@/shared/ui/atoms/button"
import { cn } from "@/shared/lib/utils"
import { dechargementCountdown } from "@/shared/lib/shipment"
import {
    ShipmentInvoiceNotice,
    ShipmentTimeline,
    type ShipmentTone,
} from "@/shared/ui/organisms/shipment-timeline"
import { GESTION_THEME } from "@/features/stock/theme"
import { UUID_DISPLAY_LENGTH } from "@/features/stock/constants"
import { isArrivageInvoiceAlert } from "@/features/stock/utils/arrivageHelpers"
import { packingGap } from "@/features/stock/utils/packingGrouping"
import {
    referenceArrivageManuel,
    type ArrivageManuelRow,
} from "@/features/stock/types/arrivage-manuel.types"
import { ArrivageStatusBadge } from "./ArrivageStatusBadge"
import { ArrivagePackingSection } from "./packing/ArrivagePackingSection"
import { formatSigned } from "./packing/packingFormat"

const numberFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 })

const EMPTY = "—"

/** Surface d'une ligne libellé / valeur. */
const ROW = GESTION_THEME.settings.section.row

interface ArrivageDetailSheetProps {
    open: boolean
    row: ArrivageManuelRow | null
    onClose: () => void
    /** Absent quand l'utilisateur n'a que le droit de lecture. */
    onEdit?: () => void
    /**
     * Ouvre la packing list (lecture ou import). Absent — droit manquant ou
     * synthèses non chargées — la section Packing list n'est pas rendue.
     */
    onOpenPacking?: () => void
}

/**
 * Fiche de CONSULTATION d'un arrivage — le pendant lecture du formulaire
 * (`ArrivageLimitedEditSheet`), sur la coque partagée
 * `shared/ui/organisms/detail-sheet`.
 *
 * Pourquoi elle existe
 * --------------------
 * Le tableau n'avait aucun clic de ligne : on n'entrait dans un arrivage que
 * par un crayon au survol, et seulement avec le droit de modification. Un
 * compte n'ayant que `stock.arrivage.view` ne pouvait donc pas consulter le
 * détail de ce qu'il voyait pourtant listé. La ligne ouvre désormais cette
 * fiche, et « Modifier » n'apparaît qu'à qui peut écrire.
 *
 * Jumelle de `FluxDetailSheet` du stock handpick, à un écart près : la liste
 * de colisage n'est pas saisie ici mais IMPORTÉE (packing list), et vit dans
 * sa propre sheet (`packing/PackingListSheet`). Les totaux saisis à la main
 * restent la référence de l'arrivage ; la fiche montre l'écart avec la packing.
 */
export function ArrivageDetailSheet({
    open,
    row,
    onClose,
    onEdit,
    onOpenPacking,
}: ArrivageDetailSheetProps) {
    if (!row) return null

    const gap = packingGap(row, row.packing)

    const reference = referenceArrivageManuel(row)
    const referenceLabel = reference
        ? new Date(reference).toLocaleDateString("fr-FR", {
              day: "2-digit",
              month: "long",
              year: "numeric",
          })
        : EMPTY

    const invoiceAlert = isArrivageInvoiceAlert(row)
    const countdown = dechargementCountdown(row.prev_dechargement_at)

    // Ordre des priorités repris du tableau : une facture manquante l'emporte
    // sur le surlignage d'un arrivage proche — la première est une action à
    // mener, la seconde une simple information.
    const tone: ShipmentTone =
        row.status === "annulé"
            ? "neutral"
            : invoiceAlert
              ? "alert"
              : row.status === "reçu" || row.status === "déchargé"
                ? "done"
                : countdown && countdown.days >= 0
                  ? "upcoming"
                  : "neutral"

    return (
        <DetailSheet
            open={open}
            onOpenChange={(value) => {
                if (!value) onClose()
            }}
            icon={Ship}
            title={row.container_no}
            titleClassName="font-mono"
            subtitle={
                <>
                    <CalendarClock size={11} className="shrink-0" />
                    <span className="truncate">{referenceLabel}</span>
                    <span className={cn("truncate", GESTION_THEME.card.identity)}>
                        {row.id.slice(0, UUID_DISPLAY_LENGTH)}
                    </span>
                </>
            }
            badge={<ArrivageStatusBadge status={row.status} auto={row.status_auto} />}
            footer={
                onEdit ? (
                    <Button size="sm" className="flex-1 gap-1.5 text-xs sm:text-sm" onClick={onEdit}>
                        <Pencil size={13} />
                        <span>Modifier</span>
                    </Button>
                ) : undefined
            }
        >
            {/* ── Section 1 : Totaux ──
                Saisis à la main sur cet arrivage, faute de liste de colisage. */}
            <section className="space-y-3">
                <h3 className={GESTION_THEME.section.groupTitle}>Totaux</h3>

                <div className="grid grid-cols-2 gap-2">
                    <InfoTile icon={<Scale size={12} />} label="Poids">
                        <span className="text-2xl font-black tracking-tighter text-foreground">
                            {row.total_weight_kg !== null
                                ? numberFormatter.format(row.total_weight_kg)
                                : EMPTY}
                        </span>
                        <span className="text-xs font-medium text-muted-foreground">kg</span>
                        {/* Pas de mention quand la packing ne pèse rien : la
                            plupart des documents du fournisseur ne comptent
                            qu'en pièces, et « 0 kg » se lirait comme un fait. */}
                        {row.packing && gap?.weightKg != null && (
                            <span className={cn("text-2xs", gap.diverges ? "text-warning" : "text-muted-foreground")}>
                                Packing : {numberFormatter.format(row.packing.total_weight_kg)} kg
                                {gap.weightKg !== 0 && ` (${formatSigned(gap.weightKg)})`}
                            </span>
                        )}
                    </InfoTile>

                    <InfoTile icon={<Package size={12} />} label="Quantité">
                        <span className="text-2xl font-black tracking-tighter text-foreground">
                            {row.total_qty !== null
                                ? numberFormatter.format(row.total_qty)
                                : EMPTY}
                        </span>
                        <span className="text-xs font-medium text-muted-foreground">colis</span>
                        {row.packing && gap?.packages != null && (
                            <span className={cn("text-2xs", gap.diverges ? "text-warning" : "text-muted-foreground")}>
                                Packing : {numberFormatter.format(row.packing.total_packages)} colis
                                {gap.packages !== 0 && ` (${formatSigned(gap.packages)})`}
                            </span>
                        )}
                    </InfoTile>
                </div>
            </section>

            {/* ── Section 1 bis : Packing list ──
                Juste sous les totaux : c'est avec eux qu'elle se compare. */}
            {onOpenPacking && row.packing !== undefined && (
                <ArrivagePackingSection packing={row.packing} onOpen={onOpenPacking} />
            )}

            {/* ── Section 2 : Acheminement ──
                Le trajet plutôt qu'une liste de dates : le déchargement est la
                date de RÉFÉRENCE (elle pilote le surlignage du tableau et les
                alertes), elle doit se voir comme un terminus et non comme la
                sixième ligne d'une énumération. */}
            <section className="space-y-3">
                <div className="flex items-center gap-2">
                    <Ship size={13} className="text-muted-foreground" />
                    <h3 className={GESTION_THEME.section.groupTitle}>Acheminement</h3>
                </div>

                <div className="rounded-xl border border-border bg-muted/30 px-4 py-4">
                    {/* Le trajet est déclaré ICI et non dans le composant : le
                        stock principal saisit encore l'escale au port, donc
                        deux segments — la traversée maritime puis
                        l'acheminement terrestre. Le handpick en déclare un
                        seul, il ne saisit plus cette date. */}
                    <ShipmentTimeline
                        stops={[
                            {
                                label: "Départ",
                                date: row.departure_date,
                                vehicle: "ship",
                            },
                            {
                                label: "Arrivée au port",
                                date: row.port_arrival_date,
                                vehicle: "truck",
                            },
                        ]}
                        arrival={{ label: "Déchargement", at: row.prev_dechargement_at }}
                        tone={tone}
                    />
                </div>

                {/* Contexte du transport : utile, jamais urgent. */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <InfoTile icon={<Building2 size={12} />} label="Fournisseur">
                        {/* Aucune clé étrangère en base : la jointure est résolue
                            côté client et peut manquer. On retombe alors sur
                            l'identifiant, comme le fait le tableau. */}
                        <span className="truncate text-sm font-medium text-foreground">
                            {row.fournisseur?.name ?? row.fournisseur_id ?? EMPTY}
                        </span>
                    </InfoTile>

                    <InfoTile icon={<Truck size={12} />} label="Mode">
                        <span className="truncate text-sm font-medium text-foreground">
                            {row.transport_mode ?? EMPTY}
                        </span>
                    </InfoTile>

                    <InfoTile icon={<Hash size={12} />} label="N° interne">
                        <span className={cn("truncate text-sm", GESTION_THEME.card.identity)}>
                            {row.conteneur_no_raw ?? EMPTY}
                        </span>
                    </InfoTile>
                </div>
            </section>

            {/* ── Section 3 : Facturation ──
                En bloc plein et non en lignes : il n'y a que trois états, et
                c'est le sujet. Un arrivage qui approche de son déchargement sans
                facture est un incident comptable et douanier. */}
            <ShipmentInvoiceNotice
                invoiceDate={row.invoice_date}
                alert={invoiceAlert}
                countdownLabel={countdown?.label}
            />

            {row.notes && (
                <DetailRow
                    icon={<StickyNote size={14} className="text-muted-foreground" />}
                    label="Notes"
                    rowClassName={cn(ROW, "items-start")}
                >
                    <span className="max-w-3xs text-right text-sm text-muted-foreground">
                        {row.notes}
                    </span>
                </DetailRow>
            )}
        </DetailSheet>
    )
}
