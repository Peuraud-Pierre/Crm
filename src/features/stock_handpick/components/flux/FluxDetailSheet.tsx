import {
    ArrowDownToLine, ArrowUpFromLine, Banknote, CalendarClock,
    Forklift, Package, Pencil, Scale, StickyNote, Tag,
} from "lucide-react"
import { DetailRow, DetailSheet, InfoTile } from "@/shared/ui/organisms/detail-sheet"
import { Button } from "@/shared/ui/atoms/button"
import { Separator } from "@/shared/ui/atoms/separator"
import { cn } from "@/shared/lib/utils"
import { dechargementCountdown } from "@/shared/lib/shipment"
import {
    ShipmentTimeline,
    type ShipmentTone,
} from "@/shared/ui/organisms/shipment-timeline"
import { HANDPICK_THEME } from "@/features/stock_handpick/theme"
import {
    MOUVEMENT_DIRECTION_LABELS,
    QUANTITY_UNIT_LABELS,
    UUID_DISPLAY_LENGTH,
} from "@/features/stock_handpick/constants"
import {
    referenceFlux,
    type FluxHandpickRow,
} from "@/features/stock_handpick/types/flux.types"
import { FluxStatusBadge } from "./FluxStatusBadge"
import { LignesPanel } from "./LignesPanel"

const numberFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 })
const currencyFormatter = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
})

const EMPTY = "—"

/** Surface d'une ligne libellé / valeur. */
const ROW = HANDPICK_THEME.settings.section.row

interface FluxDetailSheetProps {
    open: boolean
    flux: FluxHandpickRow | null
    /** Ajouter une ligne de colisage est une création (`flux.create`). */
    canCreate: boolean
    canDelete: boolean
    onClose: () => void
    /** Absent quand l'utilisateur n'a que le droit de lecture. */
    onEdit?: () => void
    /** Ouvre la balle rattachée à une ligne de colisage. */
    onOpenBalle?: (id: string) => void
}

/**
 * Fiche de CONSULTATION d'une expédition — le pendant lecture du formulaire
 * (`FluxSheet`), sur la coque partagée `shared/ui/organisms/detail-sheet`.
 *
 * Pourquoi elle existe
 * --------------------
 * Cliquer une ligne du tableau ouvrait le formulaire d'édition. Un compte
 * n'ayant que `flux.view` se voyait donc proposer une saisie que la RLS
 * refuserait — et `FluxTab` forçait `canUpdate: true` dans sa garde de lien
 * profond pour que la liste de colisage reste atteignable. Cette fiche retire
 * la raison d'être de ce contournement : elle porte le colisage, et le
 * formulaire redevient réservé à qui peut écrire.
 *
 * C'est aussi ici que vit `LignesPanel`, et non dans le formulaire. La saisie
 * de colisage écrit IMMÉDIATEMENT (`addLigne` / `removeLigne`), là où
 * `FormSheet` est un contrat brouillon → submit → close. Les mélanger est ce
 * qui a produit le contournement `seedKey` de `FluxSheet` : chaque ligne
 * ajoutée déclenche une salve realtime qui reconstruit l'expédition et
 * réamorçait la saisie de l'en-tête en cours.
 */
export function FluxDetailSheet({
    open,
    flux,
    canCreate,
    canDelete,
    onClose,
    onEdit,
    onOpenBalle,
}: FluxDetailSheetProps) {
    if (!flux) return null

    const isArrivage = flux.direction === "in"
    const noun = MOUVEMENT_DIRECTION_LABELS[flux.direction]

    // L'en-tête ne porte plus de n° de conteneur : le fournisseur identifie
    // l'expédition, à défaut le sens, pour ne jamais titrer à vide.
    const title = flux.fournisseur?.name ?? `${noun} sans usine`

    const reference = referenceFlux(flux)
    const referenceLabel = reference
        ? new Date(reference).toLocaleDateString("fr-FR", {
              day: "2-digit",
              month: "long",
              year: "numeric",
          })
        : EMPTY

    const countdown = dechargementCountdown(flux.prev_dechargement_at)

    const tone: ShipmentTone =
        flux.status === "annulé"
            ? "neutral"
            : flux.status === "reçu" || flux.status === "déchargé"
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
            icon={isArrivage ? ArrowDownToLine : ArrowUpFromLine}
            title={title}
            subtitle={
                <>
                    <CalendarClock size={11} className="shrink-0" />
                    <span className="truncate">{referenceLabel}</span>
                    <span className={cn("truncate", HANDPICK_THEME.card.identity)}>
                        {flux.id.slice(0, UUID_DISPLAY_LENGTH)}
                    </span>
                </>
            }
            badge={<FluxStatusBadge status={flux.status} />}
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
                Jamais stockés sur l'en-tête : ils sont calculés depuis les lignes,
                donc de la liste de colisage, qui fait foi. */}
            <section className="space-y-3">
                <h3 className={HANDPICK_THEME.section.groupTitle}>Totaux</h3>

                <div className="grid grid-cols-3 gap-2">
                    <InfoTile icon={<Scale size={12} />} label="Poids">
                        <span className="text-2xl font-black tracking-tighter text-foreground">
                            {numberFormatter.format(flux.total_weight_kg)}
                        </span>
                        <span className="text-xs font-medium text-muted-foreground">
                            {QUANTITY_UNIT_LABELS.kg}
                        </span>
                    </InfoTile>

                    <InfoTile icon={<Package size={12} />} label="Quantité">
                        <span className="text-2xl font-black tracking-tighter text-foreground">
                            {numberFormatter.format(flux.total_qty)}
                        </span>
                        <span className="text-xs font-medium text-muted-foreground">
                            {QUANTITY_UNIT_LABELS.pieces}
                        </span>
                    </InfoTile>

                    <InfoTile icon={<Banknote size={12} />} label="Valeur">
                        <span className="text-2xl font-black tracking-tighter text-foreground">
                            {flux.total_value > 0
                                ? currencyFormatter.format(flux.total_value)
                                : EMPTY}
                        </span>
                    </InfoTile>
                </div>
            </section>

            {/* ── Section 2 : Acheminement ──
                Le trajet plutôt qu'une liste de dates : le déchargement est la
                date de RÉFÉRENCE de ce module (elle pilote le surlignage du
                tableau et les alertes), elle doit se voir comme un terminus et
                non comme la cinquième ligne d'une énumération. */}
            <section className="space-y-3">
                <div className="flex items-center gap-2">
                    <Forklift size={13} className="text-muted-foreground" />
                    <h3 className={HANDPICK_THEME.section.groupTitle}>Acheminement</h3>
                </div>

                <div className="rounded-xl border border-border bg-muted/30 px-4 py-4">
                    {/* Un seul segment : l'en-tête ne porte pas d'arrivée au port. */}
                    <ShipmentTimeline
                        stops={[
                            {
                                label: "Départ",
                                date: flux.departure_date,
                                vehicle: "forklift",
                            },
                        ]}
                        arrival={{
                            label: "Déchargement",
                            at: flux.prev_dechargement_at,
                        }}
                        tone={tone}
                    />
                </div>
            </section>

            {flux.type && (
                <DetailRow
                    icon={<Tag size={14} className="text-muted-foreground" />}
                    label="Type"
                    rowClassName={ROW}
                >
                    <span className="text-right text-sm text-foreground">{flux.type}</span>
                </DetailRow>
            )}

            {flux.notes && (
                <DetailRow
                    icon={<StickyNote size={14} className="text-muted-foreground" />}
                    label="Notes"
                    rowClassName={cn(ROW, "items-start")}
                >
                    <span className="max-w-3xs text-right text-sm text-muted-foreground">
                        {flux.notes}
                    </span>
                </DetailRow>
            )}

            <Separator />

            {/* La liste de colisage vit ici et non dans le formulaire : voir le
                docblock du composant. */}
            <LignesPanel
                fluxId={flux.id}
                canCreate={canCreate}
                canDelete={canDelete}
                onOpenBalle={onOpenBalle}
            />
        </DetailSheet>
    )
}
