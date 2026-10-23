import { useState } from "react"
import { ExternalLink, Layers, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/shared/ui/atoms/button"
import { Skeleton } from "@/shared/ui/atoms/skeleton"
import type { SearchSelectOption } from "@/shared/ui/molecules/search-select"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import { cn } from "@/shared/lib/utils"
import { HANDPICK_THEME } from "@/features/stock_handpick/theme"
import {
    QUANTITY_UNIT_LABELS,
    UUID_DISPLAY_LENGTH,
} from "@/features/stock_handpick/constants"
import { useReferentialHandpickContext } from "@/features/stock_handpick/hooks/context/StockHandpickProvider"
import { useLignesHandpick } from "@/features/stock_handpick/hooks/data/useMouvementHandpick"
import type { MouvementFormInput } from "@/features/stock_handpick/types/flux.types"
import { LigneDraftRow } from "./LigneDraftRow"

const NONE = "__none__"
const SKELETON_KEYS = ["l1", "l2", "l3"]

const numberFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 })
const currencyFormatter = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" })

function emptyLigne(fluxId: string): MouvementFormInput {
    return {
        flux_id: fluxId,
        balle_id: null,
        balle_label: null,
        category_id: null,
        quantity: 0,
        quantity_unit: "kg",
        emplacement_from_id: null,
        emplacement_to_id: null,
        unit_price: null,
        notes: null,
    }
}

interface LignesPanelProps {
    fluxId: string
    /**
     * Ajouter une ligne est une CRÉATION : la RLS d'insertion de
     * `mouvements_handpick` exige `stock_handpick.flux.create`. Le bouton était
     * gaté sur `update` — proposé à qui la base refuserait, caché à qui elle
     * accepterait.
     */
    canCreate: boolean
    canDelete: boolean
    /** Ouvre la balle rattachée à une ligne. Absent, la pastille est inerte. */
    onOpenBalle?: (id: string) => void
}

/**
 * Liste de colisage d'une expédition : ce que le conteneur contient réellement.
 *
 * C'est la moitié qui manquait au module. L'onglet Flux listait les lignes de
 * colisage à la place des expéditions, si bien qu'un conteneur de 40 balles s'y
 * lisait comme 40 arrivages. Les lignes sont désormais ici, sous l'en-tête
 * auquel elles appartiennent.
 *
 * Saisie en ligne plutôt qu'en sheet : une sheet dans une sheet se referme mal
 * (Radix rend la pile d'overlays et l'échappement ambigus), et une liste de
 * colisage se remplit ligne après ligne — rouvrir un panneau à chaque ligne
 * serait pénible.
 *
 * Monté dans `FluxDetailSheet` et NON dans `FluxSheet` : ce panneau écrit
 * immédiatement (`addLigne` / `removeLigne`), là où le formulaire est un
 * contrat brouillon → submit → close. Les deux modèles d'écriture dans une même
 * sheet sont ce qui a produit le contournement `seedKey` de `FluxSheet`.
 *
 * Rattacher une balle à une ligne est ce qui rend la traçabilité possible en
 * sens inverse : une balle n'a pas de `flux_id`, c'est `balle_id` posé ici qui
 * permet à sa fiche de retrouver l'expédition dont elle provient.
 */
export function LignesPanel({ fluxId, canCreate, canDelete, onOpenBalle }: LignesPanelProps) {
    const { lignes, loading, addLigne, removeLigne } = useLignesHandpick(fluxId)
    const { categories } = useReferentialHandpickContext()

    const [draft, setDraft] = useState<MouvementFormInput | null>(null)
    const [saving, setSaving] = useState(false)

    const categoryOptions: SearchSelectOption[] = [
        { value: NONE, label: "Aucune catégorie" },
        ...categories.map((c) => ({ value: c.id, label: c.name })),
    ]

    const totalWeight = lignes
        .filter((l) => l.quantity_unit === "kg")
        .reduce((sum, l) => sum + l.quantity, 0)
    const totalPieces = lignes
        .filter((l) => l.quantity_unit === "pieces")
        .reduce((sum, l) => sum + l.quantity, 0)
    const totalValue = lignes.reduce((sum, l) => sum + l.total_value, 0)

    const handleAdd = async () => {
        if (!draft) return
        setSaving(true)
        try {
            await addLigne(draft)
            // On rouvre un brouillon vierge plutôt que de refermer : on saisit
            // rarement une seule ligne de colisage.
            setDraft(emptyLigne(fluxId))
        } catch (error) {
            toast.error("Ligne non enregistrée")
            console.error(error)
        } finally {
            setSaving(false)
        }
    }

    const handleRemove = async (id: string) => {
        try {
            await removeLigne(id)
        } catch (error) {
            toast.error("Ligne non supprimée")
            console.error(error)
        }
    }

    // Miroir du CHECK `mouvements_handpick_has_subject` : une ligne porte soit
    // une balle, soit une quantité en vrac rattachée à une catégorie.
    const draftValid = draft !== null && (draft.quantity > 0 || draft.balle_id !== null)

    return (
        <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <Layers size={16} className="text-muted-foreground" aria-hidden />
                    <h3 className="text-sm font-semibold text-foreground">Liste de colisage</h3>
                    <span className="text-xs tabular-nums text-muted-foreground">
                        {lignes.length} ligne{lignes.length > 1 ? "s" : ""}
                    </span>
                </div>
                {canCreate && draft === null && (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => setDraft(emptyLigne(fluxId))}
                    >
                        <Plus size={14} aria-hidden />
                        Ajouter
                    </Button>
                )}
            </div>

            {loading ? (
                <div className="flex flex-col gap-2">
                    {SKELETON_KEYS.map((key) => (
                        <Skeleton key={key} aria-hidden className="h-10 w-full rounded-lg" />
                    ))}
                </div>
            ) : lignes.length === 0 && draft === null ? (
                <EmptyState
                    size="sm"
                    icon={Layers}
                    title="Aucune ligne"
                    description="Ajoutez le détail reçu — balles ou vrac — pour que les totaux de l'expédition se calculent."
                    className={HANDPICK_THEME.board.emptyState}
                />
            ) : (
                <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
                    {lignes.map((ligne) => (
                        <li
                            key={ligne.id}
                            className="flex items-center gap-3 px-3 py-2 text-sm"
                        >
                            <div className="min-w-0 flex-1">
                                <p className="truncate font-medium text-foreground">
                                    {ligne.balle_label ?? ligne.category?.name ?? "Sans libellé"}
                                </p>
                                {ligne.balle_id && onOpenBalle && (
                                    <button
                                        type="button"
                                        onClick={() => onOpenBalle(ligne.balle_id as string)}
                                        className="flex items-center gap-1 font-mono text-3xs font-bold text-primary hover:underline"
                                    >
                                        {ligne.balle_id.slice(0, UUID_DISPLAY_LENGTH)}
                                        <ExternalLink size={9} aria-hidden />
                                    </button>
                                )}
                                {ligne.notes && (
                                    <p className="truncate text-xs text-muted-foreground">
                                        {ligne.notes}
                                    </p>
                                )}
                            </div>

                            <span className={cn("shrink-0 tabular-nums", HANDPICK_THEME.flux.amount)}>
                                {numberFormatter.format(ligne.quantity)}{" "}
                                {QUANTITY_UNIT_LABELS[ligne.quantity_unit]}
                            </span>

                            <span className="w-20 shrink-0 text-right tabular-nums text-muted-foreground">
                                {ligne.total_value > 0
                                    ? currencyFormatter.format(ligne.total_value)
                                    : "—"}
                            </span>

                            {canDelete && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                                    onClick={() => handleRemove(ligne.id)}
                                    aria-label="Supprimer la ligne"
                                >
                                    <Trash2 size={13} aria-hidden />
                                </Button>
                            )}
                        </li>
                    ))}
                </ul>
            )}

            {draft !== null && (
                <LigneDraftRow
                    draft={draft}
                    onChange={setDraft}
                    onCancel={() => setDraft(null)}
                    onAdd={handleAdd}
                    saving={saving}
                    valid={draftValid}
                    categoryOptions={categoryOptions}
                />
            )}

            {lignes.length > 0 && (
                <div className="flex flex-wrap items-center justify-end gap-4 border-t border-border pt-2 text-xs text-muted-foreground">
                    {/* Deux totaux et non un : des kilos et des pièces ne
                        s'additionnent pas. */}
                    {totalWeight > 0 && (
                        <span className="tabular-nums">
                            {numberFormatter.format(totalWeight)} kg
                        </span>
                    )}
                    {totalPieces > 0 && (
                        <span className="tabular-nums">
                            {numberFormatter.format(totalPieces)} pièces
                        </span>
                    )}
                    {totalValue > 0 && (
                        <span className="font-medium text-foreground tabular-nums">
                            {currencyFormatter.format(totalValue)}
                        </span>
                    )}
                </div>
            )}
        </section>
    )
}
