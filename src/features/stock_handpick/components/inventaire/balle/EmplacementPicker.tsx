import { useMemo, useState } from "react"
import { X } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"
import { cn } from "@/shared/lib/utils"
import type { EmplacementOption } from "@/features/stock_handpick/types/location.types"
import { PLAN_ROW_LABELS, PLAN_ZONES, type PlanRow, type PlanZoneCode } from "@/features/stock_handpick/utils/planLayout"

interface EmplacementPickerProps {
    options: EmplacementOption[]
    value: string | null
    /** `null` tant que le chemin n'est pas complet, ou pour « Non rangée ». */
    onChange: (emplacementId: string | null) => void
    disabled?: boolean
    /** Préfixe des `id` HTML, pour relier les libellés. */
    idPrefix: string
}

/** Nom d'un niveau du chemin, d'après sa position et ses valeurs. */
function levelLabel(depth: number, values: string[]): string {
    if (depth === 0) return "Zone"
    if (values.every((v) => /^H\d+$/i.test(v))) return "Hauteur"
    if (values.every((v) => /^E\d+$/i.test(v))) return "Travée"
    if (values.every((v) => /^R\d+$/i.test(v))) return "Rangée"
    return "Emplacement"
}

/** Libellé d'une valeur de niveau : « B · Bags », « R2 · Double haut ». */
function valueLabel(depth: number, value: string): string {
    if (depth === 0) {
        const zone = PLAN_ZONES[value as PlanZoneCode]
        return zone ? `${value} · ${zone.label}` : value
    }
    const row = PLAN_ROW_LABELS[value as PlanRow]
    if (row) return `${value} · ${row}`
    if (value.toUpperCase() === "SOL") return "Au sol"
    return value
}

const same = (a: readonly string[], b: readonly string[]) =>
    a.length === b.length && a.every((v, i) => v === b[i])

/**
 * Choix d'un emplacement en cascade — Zone, puis Rangée, Travée, Hauteur —
 * au lieu d'une liste de tous les codes. Les niveaux se déduisent des
 * chemins existants : une zone sans rack (A, D) s'arrête à « Au sol ».
 *
 * Un chemin incomplet n'est pas un emplacement : tant qu'il manque un niveau,
 * la valeur remontée est `null`.
 */
export function EmplacementPicker({ options, value, onChange, disabled, idPrefix }: EmplacementPickerProps) {
    const usable = useMemo(
        () => options.filter((option) => option.is_active || option.id === value),
        [options, value],
    )
    const current = usable.find((option) => option.id === value) ?? null

    // Chemin en cours de saisie ; à défaut, celui de l'emplacement choisi.
    const [partial, setPartial] = useState<string[] | null>(null)
    const prefix = partial ?? current?.segments ?? []

    // Un niveau par segment déjà choisi, plus le suivant s'il existe.
    const levels: { depth: number; values: string[]; selected: string | null }[] = []
    for (let depth = 0; depth <= prefix.length; depth++) {
        const head = prefix.slice(0, depth)
        const values = [
            ...new Set(
                usable
                    .filter((o) => o.segments.length > depth && same(o.segments.slice(0, depth), head))
                    .map((o) => o.segments[depth]),
            ),
        ].sort((a, b) => a.localeCompare(b, "fr", { numeric: true }))
        if (values.length === 0) break
        levels.push({ depth, values, selected: prefix[depth] ?? null })
    }

    const pick = (depth: number, segment: string) => {
        const next = [...prefix.slice(0, depth), segment]
        const leaf = usable.find((o) => same(o.segments, next))
        if (leaf) {
            setPartial(null)
            onChange(leaf.id)
        } else {
            setPartial(next)
            onChange(null)
        }
    }

    const clear = () => {
        setPartial(null)
        onChange(null)
    }

    if (usable.length === 0) {
        return (
            <p className="text-xs text-muted-foreground">
                Aucun emplacement défini : exécutez les migrations du plan de l'entrepôt.
            </p>
        )
    }

    return (
        <div className="space-y-2">
            <div className="flex flex-wrap items-end gap-2">
                {levels.map(({ depth, values, selected }) => {
                    const id = `${idPrefix}-level-${depth}`
                    return (
                        <div key={depth} className="flex min-w-32 flex-1 flex-col gap-1">
                            <label htmlFor={id} className="text-xs text-muted-foreground">
                                {levelLabel(depth, values)}
                            </label>
                            <Select
                                value={selected ?? ""}
                                onValueChange={(segment) => pick(depth, segment)}
                                disabled={disabled}
                            >
                                <SelectTrigger id={id} className="h-10">
                                    <SelectValue placeholder="Choisir" />
                                </SelectTrigger>
                                <SelectContent>
                                    {values.map((v) => (
                                        <SelectItem key={v} value={v}>
                                            {valueLabel(depth, v)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )
                })}
                {prefix.length > 0 && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-10 gap-1 text-muted-foreground"
                        onClick={clear}
                        disabled={disabled}
                    >
                        <X size={13} aria-hidden />
                        Non rangée
                    </Button>
                )}
            </div>
            <p className={cn("text-xs", current ? "font-mono font-semibold text-foreground" : "text-muted-foreground")}>
                {current
                    ? current.full_code
                    : prefix.length > 0
                      ? "Emplacement incomplet : choisissez les niveaux restants."
                      : "Non rangée"}
            </p>
        </div>
    )
}
