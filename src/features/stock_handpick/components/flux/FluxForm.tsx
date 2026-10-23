import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"
import { Textarea } from "@/shared/ui/atoms/textarea"
import { SearchSelect } from "@/shared/ui/molecules/search-select"
import type { SearchSelectOption } from "@/shared/ui/molecules/search-select"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"
import { FLUX_STATUS_CONFIG } from "@/features/stock_handpick/constants"
import { useReferentialHandpickContext } from "@/features/stock_handpick/hooks/context/StockHandpickProvider"
import {
    type FluxFormInput,
    type FluxHandpick,
    type FluxStatus,
    type MouvementDirection
} from "@/features/stock_handpick/types/flux.types"

/** `""` en valeur de Select signifie « aucun » : Radix refuse un item vide. */
const NONE = "__none__"

export function emptyFluxForm(direction: MouvementDirection): FluxFormInput {
    return {
        direction,
        status: "planifié",
        fournisseur_id: null,
        type: null,
        poids_kg: null,
        departure_date: null,
        prev_dechargement_at: null,
        notes: null,
    }
}

export function toFluxFormInput(row: FluxHandpick): FluxFormInput {
    return {
        direction: row.direction,
        status: row.status,
        fournisseur_id: row.fournisseur_id,
        type: row.type,
        poids_kg: row.poids_kg,
        departure_date: row.departure_date,
        prev_dechargement_at: row.prev_dechargement_at,
        notes: row.notes,
    }
}

/**
 * `<input type="datetime-local">` ne comprend ni le fuseau ni les secondes.
 *
 * Le garde-fou sur `Number.isNaN` n'est pas décoratif : sur un horodatage que
 * le navigateur ne sait pas lire, les accesseurs rendent `NaN` et la fonction
 * produisait `NaN-aN-aNTaN:aN`. Le champ refuse alors la valeur EN SILENCE et
 * s'affiche vide — indiscernable d'une date jamais saisie. Mieux vaut un vide
 * assumé qu'un vide accidentel.
 */
function toLocalInput(iso: string | null): string {
    if (!iso) return ""
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ""
    const pad = (n: number) => String(n).padStart(2, "0")
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

interface FluxFormProps {
    value: FluxFormInput
    onChange: (next: FluxFormInput) => void
    disabled?: boolean
}

/**
 * Champs d'en-tête d'une expédition : ce qui décrit le transport, pas son
 * contenu. Le contenu est la liste de colisage, saisie sous ce formulaire.
 *
 * Les champs suivent l'ordre du tableau des arrivages du stock principal, réduits
 * à ceux que porte `flux_handpick`.
 */
export function FluxForm({ value, onChange, disabled }: FluxFormProps) {
    const { fournisseurs } = useReferentialHandpickContext()

    const patch = (partial: Partial<FluxFormInput>) => onChange({ ...value, ...partial })

    const fournisseurOptions: SearchSelectOption[] = [
        { value: NONE, label: "Aucune usine" },
        ...fournisseurs.map((f) => ({ value: f.id, label: f.name })),
    ]

    return (
        <div className="flex flex-col gap-4">

            <SearchSelect
                label="Usine"
                size="md"
                searchable
                options={fournisseurOptions}
                value={value.fournisseur_id ?? NONE}
                onChange={(next) => patch({ fournisseur_id: next === NONE ? null : next })}
                emptyMessage="Aucune usine"
                className={disabled ? "pointer-events-none opacity-50" : undefined}
            />

            <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                    <Label htmlFor="hp-flux-type" className="text-sm font-semibold">
                        Type
                    </Label>
                    <Input
                        id="hp-flux-type"
                        value={value.type ?? ""}
                        onChange={(e) => patch({ type: e.target.value || null })}
                        disabled={disabled}
                    />
                </div>

                <div className="flex flex-col gap-2">
                    <Label htmlFor="hp-flux-poids" className="text-sm font-semibold">
                        Poids (kg)
                    </Label>
                    <Input
                        id="hp-flux-poids"
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="0.01"
                        value={value.poids_kg ?? ""}
                        onChange={(e) =>
                            patch({
                                poids_kg: e.target.value === "" ? null : Number(e.target.value),
                            })
                        }
                        placeholder="Calculé depuis le colisage"
                        disabled={disabled}
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                    <Label htmlFor="hp-flux-status" className="text-sm font-semibold">
                        Statut
                    </Label>
                    <Select
                        value={value.status}
                        disabled={disabled}
                        onValueChange={(next) => patch({ status: next as FluxStatus })}
                    >
                        <SelectTrigger id="hp-flux-status" className="h-10">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {Object.entries(FLUX_STATUS_CONFIG).map(([key, cfg]) => (
                                <SelectItem key={key} value={key}>
                                    {cfg.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex flex-col gap-2">
                    <Label htmlFor="hp-flux-depart" className="text-sm font-semibold">
                        Départ
                    </Label>
                    <Input
                        id="hp-flux-depart"
                        type="date"
                        value={value.departure_date ?? ""}
                        onChange={(e) => patch({ departure_date: e.target.value || null })}
                        disabled={disabled}
                    />
                </div>
            </div>

            <div className="flex flex-col gap-2">
                <Label htmlFor="hp-flux-dechargement" className="text-sm font-semibold">
                    Déchargement prévu
                </Label>
                <Input
                    id="hp-flux-dechargement"
                    type="datetime-local"
                    value={toLocalInput(value.prev_dechargement_at)}
                    onChange={(e) =>
                        patch({
                            prev_dechargement_at: e.target.value
                                ? new Date(e.target.value).toISOString()
                                : null,
                        })
                    }
                    disabled={disabled}
                />
                <p className="text-xs text-muted-foreground">
                    Date de référence de l'expédition : elle décide de son mois dans le tableau
                    et du surlignage des prochaines arrivées.
                </p>
            </div>

            <div className="flex flex-col gap-2">
                <Label htmlFor="hp-flux-notes" className="text-sm font-semibold">
                    Notes
                </Label>
                <Textarea
                    id="hp-flux-notes"
                    value={value.notes ?? ""}
                    onChange={(e) => patch({ notes: e.target.value || null })}
                    rows={3}
                    disabled={disabled}
                />
            </div>
        </div>
    )
}
