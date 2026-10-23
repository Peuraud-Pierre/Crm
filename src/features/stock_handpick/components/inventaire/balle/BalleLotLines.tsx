import { useEffect, useRef } from "react"
import { Copy, Plus, Trash2 } from "lucide-react"
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
import { useBalleHandpickContext } from "@/features/stock_handpick/hooks/context/StockHandpickProvider"
import type { PackingMode } from "@/features/stock_handpick/types/balle.types"
import {
    duplicateLine,
    emptyLine,
    type BalleLotLine,
} from "@/features/stock_handpick/utils/balleLot"
import { BalleCategorySelect } from "./BalleFournisseurCategorySelects"
import { EmplacementPicker } from "./EmplacementPicker"
import { toNumberOrNull } from "./BalleForm"

interface BalleLotLinesProps {
    lines: BalleLotLine[]
    onChange: (lines: BalleLotLine[]) => void
    disabled?: boolean
}

/**
 * Les balles d'une création en lot : une carte par balle, avec ce qui varie
 * d'une balle à l'autre (libellé, catégorie, quantité, emplacement).
 * « Dupliquer » sert l'arrivage type : plusieurs balles au même emplacement,
 * où seuls le poids ou la catégorie changent.
 */
export function BalleLotLines({ lines, onChange, disabled = false }: BalleLotLinesProps) {
    const { emplacementOptions } = useBalleHandpickContext()

    // Sur téléphone, une carte ajoutée tombe sous la ligne de flottaison :
    // on la fait défiler dans la vue et on place le curseur sur son libellé.
    const lastCardRef = useRef<HTMLFieldSetElement>(null)
    const previousCountRef = useRef(lines.length)
    useEffect(() => {
        if (lines.length > previousCountRef.current) {
            const card = lastCardRef.current
            card?.scrollIntoView?.({ behavior: "smooth", block: "nearest" })
            card?.querySelector("input")?.focus({ preventScroll: true })
        }
        previousCountRef.current = lines.length
    }, [lines.length])

    const patchLine = (key: string, partial: Partial<BalleLotLine>) =>
        onChange(lines.map((line) => (line.key === key ? { ...line, ...partial } : line)))

    const duplicate = (index: number) =>
        onChange([...lines.slice(0, index + 1), duplicateLine(lines[index]), ...lines.slice(index + 1)])

    const remove = (key: string) => onChange(lines.filter((line) => line.key !== key))

    return (
        <div className="flex flex-col gap-3">
            <span className="text-sm font-semibold">
                Balles <span className="font-normal text-muted-foreground">({lines.length})</span>
            </span>

            {lines.map((line, index) => {
                const id = `hp-lot-${line.key}`
                return (
                    <fieldset
                        key={line.key}
                        ref={index === lines.length - 1 ? lastCardRef : undefined}
                        className="flex flex-col gap-3 rounded-xl border border-border bg-muted/20 p-3"
                        disabled={disabled}
                    >
                        <div className="flex items-center justify-between">
                            <legend className="text-xs font-semibold text-muted-foreground">
                                Balle {index + 1}
                            </legend>
                            <div className="flex gap-1">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-10 gap-1 text-xs sm:h-7"
                                    onClick={() => duplicate(index)}
                                    aria-label={`Dupliquer la balle ${index + 1}`}
                                >
                                    <Copy size={12} aria-hidden />
                                    Dupliquer
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-10 w-10 p-0 text-muted-foreground hover:text-destructive sm:h-7 sm:w-7"
                                    onClick={() => remove(line.key)}
                                    disabled={lines.length === 1}
                                    aria-label={`Retirer la balle ${index + 1}`}
                                >
                                    <Trash2 size={13} aria-hidden />
                                </Button>
                            </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor={`${id}-name`} className="text-xs font-semibold">
                                Libellé
                            </Label>
                            <Input
                                id={`${id}-name`}
                                value={line.raw_name ?? ""}
                                onChange={(event) => patchLine(line.key, { raw_name: event.target.value || null })}
                                placeholder="Ex : Vêtements homme été"
                                className="h-10"
                            />
                        </div>

                        <BalleCategorySelect
                            value={line.category_id}
                            onChange={(categoryId) => patchLine(line.key, { category_id: categoryId })}
                            disabled={disabled}
                        />

                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor={`${id}-packing`} className="text-xs font-semibold">
                                    Quantité
                                </Label>
                                <Input
                                    id={`${id}-packing`}
                                    value={line.packing ?? ""}
                                    onChange={(event) =>
                                        patchLine(line.key, { packing: toNumberOrNull(event.target.value) })
                                    }
                                    placeholder="0"
                                    type="number"
                                    min="0"
                                    step="0.001"
                                    className="h-10"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor={`${id}-mode`} className="text-xs font-semibold">
                                    Unité
                                </Label>
                                <Select
                                    value={line.packing_mode}
                                    onValueChange={(mode) => patchLine(line.key, { packing_mode: mode as PackingMode })}
                                    disabled={disabled}
                                >
                                    <SelectTrigger id={`${id}-mode`} className="h-10">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="kilos">Kilos</SelectItem>
                                        <SelectItem value="pieces">Pièces</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <span className="text-xs font-semibold">Emplacement</span>
                            <EmplacementPicker
                                idPrefix={`${id}-emplacement`}
                                options={emplacementOptions}
                                value={line.emplacement_id}
                                onChange={(emplacementId) => patchLine(line.key, { emplacement_id: emplacementId })}
                                disabled={disabled}
                            />
                        </div>
                    </fieldset>
                )
            })}

            <Button
                type="button"
                variant="outline"
                className="gap-1.5"
                onClick={() => onChange([...lines, emptyLine()])}
                disabled={disabled}
            >
                <Plus size={14} aria-hidden />
                Ajouter une balle
            </Button>
        </div>
    )
}
