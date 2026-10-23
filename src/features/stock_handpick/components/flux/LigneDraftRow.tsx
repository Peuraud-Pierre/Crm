import { useEffect, useRef, useState } from "react"
import { X } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"
import { SearchSelect } from "@/shared/ui/molecules/search-select"
import type { SearchSelectOption } from "@/shared/ui/molecules/search-select"
import { cn } from "@/shared/lib/utils"
import { HANDPICK_THEME } from "@/features/stock_handpick/theme"
import {
    QUANTITY_UNIT_LABELS,
    UUID_DISPLAY_LENGTH,
} from "@/features/stock_handpick/constants"
import { searchBalles } from "@/features/stock_handpick/services/balleHandpickService"
import { useBalleHandpickContext } from "@/features/stock_handpick/hooks/context/StockHandpickProvider"
import type { BalleHandpick } from "@/features/stock_handpick/types/balle.types"
import type {
    MouvementFormInput,
    QuantityUnit,
} from "@/features/stock_handpick/types/flux.types"

const NONE = "__none__"

/** Résultats serveur ramenés par frappe — au-delà, la liste devient illisible. */
const BALLE_SEARCH_LIMIT = 20
/** Silence après la dernière frappe avant d'interroger la base. */
const SEARCH_DEBOUNCE_MS = 250

interface LigneDraftRowProps {
    draft: MouvementFormInput
    onChange: (draft: MouvementFormInput) => void
    onCancel: () => void
    onAdd: () => void
    saving: boolean
    valid: boolean
    categoryOptions: SearchSelectOption[]
}

function balleOption(balle: BalleHandpick): SearchSelectOption {
    return {
        value: balle.id,
        // Une balle n'a pas de code lisible : sans libellé, son UUID tronqué
        // est sa seule identité affichable.
        label: balle.raw_name ?? balle.id.slice(0, UUID_DISPLAY_LENGTH),
        subLabel: [
            balle.category?.name,
            balle.packing !== null
                ? `${balle.packing} ${
                      balle.packing_mode === "pieces"
                          ? QUANTITY_UNIT_LABELS.pieces
                          : QUANTITY_UNIT_LABELS.kg
                  }`
                : null,
        ]
            .filter(Boolean)
            .join(" · "),
    }
}

/**
 * Ligne de saisie d'une liste de colisage.
 *
 * Extraite de `LignesPanel` pour lui laisser sa taille : le panneau garde la
 * liste, les totaux et les écritures, cette ligne porte la saisie.
 *
 * Le champ qui compte est le premier : RATTACHER UNE BALLE. C'est lui qui pose
 * `mouvements_handpick.balle_id`, et donc le seul lien qui existe entre une
 * balle et l'arrivage dont elle provient — une balle ne porte aucun `flux_id`.
 * Tant que ce champ n'existait pas, la colonne restait vide en base et la
 * traçabilité de la fiche d'une balle n'avait rien à afficher.
 *
 * Une ligne reste valide SANS balle : c'est le cas du vrac, rattaché à une
 * catégorie. Le `CHECK mouvements_handpick_has_subject` accepte les deux.
 */
export function LigneDraftRow({
    draft,
    onChange,
    onCancel,
    onAdd,
    saving,
    valid,
    categoryOptions,
}: LigneDraftRowProps) {
    const { balles } = useBalleHandpickContext()

    // Résultats serveur, fusionnés au palier déjà en mémoire. L'inventaire est
    // paginé : s'en tenir au palier rendrait toute balle plus ancienne
    // introuvable, sans que rien ne le signale à l'écran.
    const [found, setFound] = useState<BalleHandpick[]>([])
    const [query, setQuery] = useState("")
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        if (timerRef.current) clearTimeout(timerRef.current)
        if (!query.trim()) {
            // Vider n'est pas dérivable d'un rendu : c'est l'abandon d'une
            // recherche serveur en cours, au même titre que le `clearTimeout`
            // au-dessus. Sans cela, les résultats de la frappe précédente
            // resteraient proposés après un champ effacé.
            // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
            setFound([])
            return
        }
        // Le debounce n'annule que les requêtes pas encore parties. Une requête
        // déjà en vol pour « ab » peut revenir APRÈS celle de « abc » : sans
        // cette garde, ses résultats écraseraient les bons.
        let stale = false
        timerRef.current = setTimeout(() => {
            searchBalles(query, BALLE_SEARCH_LIMIT)
                .then((rows) => {
                    if (!stale) setFound(rows)
                })
                // Échec silencieux : le palier en mémoire reste proposé, la
                // saisie n'est pas bloquée pour autant.
                .catch((error) => {
                    console.error(error)
                    if (!stale) setFound([])
                })
        }, SEARCH_DEBOUNCE_MS)

        return () => {
            stale = true
            if (timerRef.current) clearTimeout(timerRef.current)
        }
    }, [query])

    const merged = [...balles, ...found.filter((f) => !balles.some((b) => b.id === f.id))]

    const balleOptions: SearchSelectOption[] = [
        { value: NONE, label: "Vrac — aucune balle" },
        ...merged.map(balleOption),
    ]

    const handleBalle = (next: string) => {
        if (next === NONE || next === "") {
            // Le libellé est conservé : sans balle, c'est du vrac, et il reste
            // la seule description de la ligne.
            onChange({ ...draft, balle_id: null })
            return
        }

        const balle = merged.find((b) => b.id === next)
        if (!balle) return

        onChange({
            ...draft,
            balle_id: balle.id,
            // Snapshot, pas une redondance : la FK est `ON DELETE SET NULL`, le
            // libellé doit survivre à la suppression de la balle.
            balle_label: balle.raw_name ?? balle.id.slice(0, UUID_DISPLAY_LENGTH),
            // Préremplissages, tous réouvrables à la main juste en dessous.
            category_id: balle.category_id ?? draft.category_id,
            quantity: balle.packing ?? draft.quantity,
            quantity_unit: balle.packing_mode === "pieces" ? "pieces" : "kg",
        })
    }

    return (
        <div className={cn(HANDPICK_THEME.settings.editRow, "flex-col")}>
            <div className="flex w-full flex-col gap-1.5">
                <Label className={HANDPICK_THEME.settings.fieldLabel}>Balle rattachée</Label>
                <SearchSelect
                    size="sm"
                    searchable
                    options={balleOptions}
                    value={draft.balle_id ?? NONE}
                    onChange={handleBalle}
                    onSearchChange={setQuery}
                    emptyMessage="Aucune balle — affinez la recherche"
                />
            </div>

            <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-end">
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <Label htmlFor="hp-ligne-label" className={HANDPICK_THEME.settings.fieldLabel}>
                        Libellé
                    </Label>
                    <Input
                        id="hp-ligne-label"
                        value={draft.balle_label ?? ""}
                        onChange={(e) =>
                            onChange({ ...draft, balle_label: e.target.value || null })
                        }
                        placeholder="Ex : Vêtements homme été"
                        disabled={saving}
                        className="h-9"
                    />
                </div>

                <div className="flex w-full flex-col gap-1.5 sm:w-44">
                    <Label className={HANDPICK_THEME.settings.fieldLabel}>Catégorie</Label>
                    <SearchSelect
                        size="sm"
                        searchable
                        options={categoryOptions}
                        value={draft.category_id ?? NONE}
                        onChange={(next) =>
                            onChange({ ...draft, category_id: next === NONE ? null : next })
                        }
                        emptyMessage="Aucune catégorie"
                    />
                </div>

                <div className="flex w-full flex-col gap-1.5 sm:w-28">
                    <Label htmlFor="hp-ligne-qty" className={HANDPICK_THEME.settings.fieldLabel}>
                        Quantité
                    </Label>
                    <Input
                        id="hp-ligne-qty"
                        type="number"
                        min={0}
                        step="0.001"
                        value={draft.quantity || ""}
                        onChange={(e) =>
                            onChange({ ...draft, quantity: Number(e.target.value) || 0 })
                        }
                        disabled={saving}
                        className="h-9 text-right"
                    />
                </div>

                <div className="flex w-full flex-col gap-1.5 sm:w-24">
                    <Label className={HANDPICK_THEME.settings.fieldLabel}>Unité</Label>
                    <Select
                        value={draft.quantity_unit}
                        disabled={saving}
                        onValueChange={(next) =>
                            onChange({ ...draft, quantity_unit: next as QuantityUnit })
                        }
                    >
                        <SelectTrigger className="h-9" aria-label="Unité">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {Object.entries(QUANTITY_UNIT_LABELS).map(([key, label]) => (
                                <SelectItem key={key} value={key}>
                                    {label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex w-full flex-col gap-1.5 sm:w-28">
                    <Label htmlFor="hp-ligne-price" className={HANDPICK_THEME.settings.fieldLabel}>
                        Prix unitaire
                    </Label>
                    <Input
                        id="hp-ligne-price"
                        type="number"
                        min={0}
                        step="0.0001"
                        value={draft.unit_price ?? ""}
                        onChange={(e) =>
                            onChange({
                                ...draft,
                                unit_price: e.target.value ? Number(e.target.value) : null,
                            })
                        }
                        disabled={saving}
                        className="h-9 text-right"
                    />
                </div>

                <div className="flex shrink-0 items-center gap-1 sm:pb-0.5">
                    <Button
                        type="button"
                        size="sm"
                        className="h-9"
                        disabled={!valid || saving}
                        loading={saving}
                        onClick={onAdd}
                    >
                        Ajouter
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-muted-foreground"
                        onClick={onCancel}
                        aria-label="Annuler la saisie"
                    >
                        <X size={14} aria-hidden />
                    </Button>
                </div>
            </div>
        </div>
    )
}
