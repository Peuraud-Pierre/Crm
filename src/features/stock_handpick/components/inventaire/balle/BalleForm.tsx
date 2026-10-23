import type { ReactNode } from "react"
import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"
import { Textarea } from "@/shared/ui/atoms/textarea"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"
import {
    BALLE_STATUS_CONFIG,
    BALLE_STATUS_SELECTABLE,
    BALLE_TYPE_LABELS,
} from "@/features/stock_handpick/constants"
import type {
    BalleHandpickFormInput,
    BalleHandpickStatus,
    BalleHandpickType,
    PackingMode,
} from "@/features/stock_handpick/types/balle.types"
import { BalleFournisseurCategorySelects, BalleUsineSelect } from "./BalleFournisseurCategorySelects"

export const EMPTY_BALLE_FORM: BalleHandpickFormInput = {
    packing: null,
    packing_mode: "kilos",
    import_date: null,
    fournisseur_id: null,
    category_id: null,
    raw_name: null,
    provenance: null,
    is_original: true,
    parent_balle_id: null,
    status: "stocked",
    // Plus saisie : posée par l'emplacement (entrepôt) ou l'emprunt (handpick).
    location: null,
    type: null,
    emplacement_id: null,
    purchase_price: null,
    treatment_cost: null,
    notes: null,
}

/** Champ numérique vide → null, et non 0 : « non renseigné » n'est pas « zéro ». */
export function toNumberOrNull(value: string): number | null {
    const trimmed = value.trim()
    if (trimmed === "") return null
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) ? parsed : null
}

/** `""` en valeur de Select signifie « aucun » : Radix refuse un item vide. */
const NONE = "__none__"

interface BalleFormProps {
    value: BalleHandpickFormInput
    onChange: (value: BalleHandpickFormInput) => void
    disabled?: boolean
    /**
     * Création en lot : les champs propres à chaque balle (libellé,
     * catégorie, quantité, emplacement) sortent du formulaire et sont
     * saisis ligne par ligne dans ce bloc. Le formulaire ne garde que
     * les champs communs à tout le lot.
     */
    lotLines?: ReactNode
}

/**
 * Champs d'une balle, partagés par la sheet de création (en lot) et celle
 * d'édition (une balle) : une seule définition des champs communs.
 */
export function BalleForm({ value, onChange, disabled = false, lotLines }: BalleFormProps) {
    const isLot = lotLines !== undefined

    const patch = (partial: Partial<BalleHandpickFormInput>) => onChange({ ...value, ...partial })

    return (
        <div className="flex flex-col gap-5">
            {!isLot && (
                <div className="flex flex-col gap-2">
                    <Label htmlFor="hp-balle-name" className="text-sm font-semibold">
                        Libellé
                    </Label>
                    <Input
                        id="hp-balle-name"
                        value={value.raw_name ?? ""}
                        onChange={(event) => patch({ raw_name: event.target.value || null })}
                        placeholder="Ex : Vêtements homme été"
                        className="h-10"
                        disabled={disabled}
                        autoFocus
                    />
                    <p className="text-xs text-muted-foreground">
                        Libellé de la packing list. Une balle n'a pas de code : elle est identifiée par
                        son identifiant technique.
                    </p>
                </div>
            )}

            {isLot ? (
                <BalleUsineSelect
                    value={value.fournisseur_id}
                    onChange={(id) => patch({ fournisseur_id: id })}
                    disabled={disabled}
                />
            ) : (
                <BalleFournisseurCategorySelects
                    fournisseurId={value.fournisseur_id}
                    categoryId={value.category_id}
                    onFournisseurChange={(id) => patch({ fournisseur_id: id })}
                    onCategoryChange={(id) => patch({ category_id: id })}
                    disabled={disabled}
                />
            )}

            {!isLot && (
                <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="hp-balle-packing" className="text-sm font-semibold">
                            Quantité
                        </Label>
                        <Input
                            id="hp-balle-packing"
                            value={value.packing ?? ""}
                            onChange={(event) => patch({ packing: toNumberOrNull(event.target.value) })}
                            placeholder="0"
                            type="number"
                            min="0"
                            step="0.001"
                            className="h-10"
                            disabled={disabled}
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <Label htmlFor="hp-balle-packing-mode" className="text-sm font-semibold">
                            Unité
                        </Label>
                        <Select
                            value={value.packing_mode}
                            onValueChange={(mode) => patch({ packing_mode: mode as PackingMode })}
                            disabled={disabled}
                        >
                            <SelectTrigger id="hp-balle-packing-mode" className="h-10">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="kilos">Kilos</SelectItem>
                                <SelectItem value="pieces">Pièces</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                    <Label htmlFor="hp-balle-status" className="text-sm font-semibold">
                        Statut
                    </Label>
                    <Select
                        value={value.status}
                        onValueChange={(status) => patch({ status: status as BalleHandpickStatus })}
                        // Une balle éclatée l'est définitivement : le CHECK
                        // `balles_handpick_eclatee_coherent` refuserait tout autre statut.
                        disabled={disabled || value.status === "eclatee"}
                    >
                        <SelectTrigger id="hp-balle-status" className="h-10">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {value.status === "eclatee" && (
                                <SelectItem value="eclatee">
                                    {BALLE_STATUS_CONFIG.eclatee.label}
                                </SelectItem>
                            )}
                            {BALLE_STATUS_SELECTABLE.map((status) => (
                                <SelectItem key={status} value={status}>
                                    {BALLE_STATUS_CONFIG[status].label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex flex-col gap-2">
                    <Label htmlFor="hp-balle-type" className="text-sm font-semibold">
                        Type
                    </Label>
                    <Select
                        value={value.type ?? NONE}
                        onValueChange={(type) =>
                            patch({ type: type === NONE ? null : (type as BalleHandpickType) })
                        }
                        disabled={disabled}
                    >
                        <SelectTrigger id="hp-balle-type" className="h-10">
                            <SelectValue placeholder="Non précisé" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={NONE}>Non précisé</SelectItem>
                            {Object.entries(BALLE_TYPE_LABELS).map(([key, label]) => (
                                <SelectItem key={key} value={key}>
                                    {label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex flex-col gap-2">
                    <Label htmlFor="hp-balle-import-date" className="text-sm font-semibold">
                        Date d'entrée
                    </Label>
                    <Input
                        id="hp-balle-import-date"
                        value={value.import_date ? value.import_date.slice(0, 10) : ""}
                        onChange={(event) =>
                            patch({
                                import_date: event.target.value
                                    ? new Date(event.target.value).toISOString()
                                    : null,
                            })
                        }
                        type="date"
                        className="h-10"
                        disabled={disabled}
                    />
                </div>
            </div>

            {/* Pas d'emplacement en édition : ranger, emprunter, rendre ou
                déplacer passe par les actions de la fiche
                (BalleEmplacementSection), atomiques et gardées contre une
                balle empruntée ou éclatée entre-temps. Un brouillon réécrivait
                l'ancien emplacement par-dessus ces actions. */}
            {lotLines}

            <div className="flex flex-col gap-2">
                <Label htmlFor="hp-balle-notes" className="text-sm font-semibold">
                    Notes
                </Label>
                <Textarea
                    id="hp-balle-notes"
                    value={value.notes ?? ""}
                    onChange={(event) => patch({ notes: event.target.value || null })}
                    placeholder="Observations…"
                    rows={3}
                    disabled={disabled}
                />
            </div>
        </div>
    )
}
