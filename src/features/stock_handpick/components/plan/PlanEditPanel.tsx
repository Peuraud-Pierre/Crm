import type { ReactNode } from "react"
import { RotateCw, Trash2 } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"
import { Switch } from "@/shared/ui/atoms/switch"
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"
import { PLAN_ROW_LABELS, type PlanRow, type PlanZoneCode } from "@/features/stock_handpick/utils/planLayout"
import type { FloorLayout, Rect } from "@/features/stock_handpick/utils/floorPlan"
import {
    ANGLED_KINDS,
    ELEMENT_KIND_LABELS,
    FIXED_KINDS,
    RECT_KINDS,
    elementRect,
    elementRotation,
    freeRows,
    segmentAngle,
    setRotation,
    updateElement,
    updateRect,
    type ElementRef,
} from "@/features/stock_handpick/utils/floorPlanEdit"
import { ADD_TEMPLATES, type AddTemplate } from "@/features/stock_handpick/utils/floorPlanTemplates"

const NONE = "__none__"
const GROUPS: AddTemplate["group"][] = ["Structure", "Réserve", "Boutique", "Annexe"]

interface PlanAddMenuProps {
    onAdd: (templateId: string) => void
}

/** Menu « Ajouter un élément », classé par famille. */
export function PlanAddMenu({ onAdd }: PlanAddMenuProps) {
    return (
        <Select value="" onValueChange={onAdd}>
            <SelectTrigger className="h-9 w-full sm:w-56" aria-label="Ajouter un élément">
                <SelectValue placeholder="+ Ajouter un élément" />
            </SelectTrigger>
            <SelectContent>
                {GROUPS.map((group) => (
                    <SelectGroup key={group}>
                        <SelectLabel>{group}</SelectLabel>
                        {ADD_TEMPLATES.filter((t) => t.group === group).map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                                {t.label}
                            </SelectItem>
                        ))}
                    </SelectGroup>
                ))}
            </SelectContent>
        </Select>
    )
}

interface PlanEditPanelProps {
    floor: FloorLayout
    selected: ElementRef | null
    onChange: (floor: FloorLayout) => void
    onRotate: () => void
    /** Tourne de quelques degrés (diagonales). */
    onRotateBy: (degrees: number) => void
    onRemove: () => void
}

function Field({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">{label}</Label>
            {children}
        </div>
    )
}

function NumberInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
    return (
        <Input
            type="number"
            step="0.1"
            inputMode="decimal"
            value={Number.isFinite(value) ? Math.round(value * 100) / 100 : ""}
            onChange={(e) => {
                const next = Number(e.target.value)
                if (e.target.value !== "" && Number.isFinite(next)) onChange(next)
            }}
            className="h-8"
        />
    )
}

/**
 * Propriétés de l'élément sélectionné. Chaque saisie est une modification
 * complète, qui entre dans l'historique de l'éditeur.
 */
export function PlanEditPanel({ floor, selected, onChange, onRotate, onRotateBy, onRemove }: PlanEditPanelProps) {
    if (!selected) {
        return (
            <div className="space-y-2 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Aucun élément sélectionné</p>
                <ul className="list-disc space-y-1 pl-4 text-xs">
                    <li>Cliquez un élément du plan pour le sélectionner.</li>
                    <li>Glissez-le pour le déplacer ; la poignée du coin le redimensionne.</li>
                    <li>Flèches : ajuster de 10 cm (Maj : 1 m). R : quart de tour. Suppr : retirer.</li>
                    <li>[ et ] : tourner de 15° pour poser en diagonale.</li>
                    <li>Une zone se déplace par son étiquette « Zone … ».</li>
                </ul>
            </div>
        )
    }

    const rect = elementRect(floor, selected)
    const setRect = (key: keyof Rect) => (value: number) =>
        onChange(updateRect(floor, selected, (r) => ({ ...r, [key]: value })))
    const set = (patch: Record<string, unknown>) => onChange(updateElement(floor, selected, patch))

    const rack = selected.kind === "rack" ? floor.racks.find((r) => r.id === selected.id) : null
    const fixture = selected.kind === "fixture" ? floor.fixtures.find((f) => f.id === selected.id) : null
    const office = selected.kind === "office" ? floor.offices.find((o) => o.id === selected.id) : null
    const door = selected.kind === "door" ? floor.doors.find((d) => d.id === selected.id) : null
    const wall = selected.kind === "wall" ? floor.innerWalls.find((w) => w.id === selected.id) : null
    const pillar = selected.kind === "pillar" ? floor.pillars.find((p) => p.id === selected.id) : null
    const spot = selected.kind === "baleSpot" ? floor.baleSpots[selected.id as "A" | "D"] : null
    const segment = door ?? wall

    const setPoint = (end: "from" | "to", index: 0 | 1) => (value: number) => {
        if (!segment) return
        const point = [...segment[end]] as [number, number]
        point[index] = value
        set({ [end]: point })
    }

    const templateLabel = fixture
        ? ADD_TEMPLATES.find((t) => t.id === `fixture:${fixture.kind}`)?.label
        : null

    return (
        <div className="space-y-4">
            <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {ELEMENT_KIND_LABELS[selected.kind]}
                </p>
                <p className="font-mono text-sm font-bold text-foreground">
                    {templateLabel ?? (selected.kind === "zone" ? `Zone ${selected.id as PlanZoneCode}` : selected.id)}
                </p>
            </div>

            {rect && RECT_KINDS.has(selected.kind) && (
                <div className="grid grid-cols-2 gap-2">
                    <Field label="X (m)"><NumberInput value={rect.x} onChange={setRect("x")} /></Field>
                    <Field label="Z (m)"><NumberInput value={rect.z} onChange={setRect("z")} /></Field>
                    <Field label="Largeur (m)"><NumberInput value={rect.w} onChange={setRect("w")} /></Field>
                    <Field label="Profondeur (m)"><NumberInput value={rect.d} onChange={setRect("d")} /></Field>
                </div>
            )}

            {(pillar || spot) && (
                <div className="grid grid-cols-2 gap-2">
                    <Field label="X (m)">
                        <NumberInput
                            value={(pillar ?? spot)!.x}
                            onChange={(x) =>
                                pillar
                                    ? onChange({ ...floor, pillars: floor.pillars.map((p) => (p.id === pillar.id ? { ...p, x } : p)) })
                                    : onChange({ ...floor, baleSpots: { ...floor.baleSpots, [selected.id]: { ...spot!, x } } })
                            }
                        />
                    </Field>
                    <Field label="Z (m)">
                        <NumberInput
                            value={(pillar ?? spot)!.z}
                            onChange={(z) =>
                                pillar
                                    ? onChange({ ...floor, pillars: floor.pillars.map((p) => (p.id === pillar.id ? { ...p, z } : p)) })
                                    : onChange({ ...floor, baleSpots: { ...floor.baleSpots, [selected.id]: { ...spot!, z } } })
                            }
                        />
                    </Field>
                </div>
            )}

            {segment && (
                <div className="grid grid-cols-2 gap-2">
                    <Field label="Début X"><NumberInput value={segment.from[0]} onChange={setPoint("from", 0)} /></Field>
                    <Field label="Début Z"><NumberInput value={segment.from[1]} onChange={setPoint("from", 1)} /></Field>
                    <Field label="Fin X"><NumberInput value={segment.to[0]} onChange={setPoint("to", 0)} /></Field>
                    <Field label="Fin Z"><NumberInput value={segment.to[1]} onChange={setPoint("to", 1)} /></Field>
                </div>
            )}

            {(ANGLED_KINDS.has(selected.kind) || segment) && (
                <div className="space-y-1.5">
                    <Field label="Angle (°)">
                        <NumberInput
                            value={segment ? segmentAngle(floor, selected) : elementRotation(floor, selected)}
                            onChange={(degrees) => onChange(setRotation(floor, selected, degrees))}
                        />
                    </Field>
                    <div className="flex flex-wrap gap-1">
                        {[
                            { label: "−15°", run: () => onRotateBy(-15) },
                            { label: "+15°", run: () => onRotateBy(15) },
                            { label: "45°", run: () => onChange(setRotation(floor, selected, 45)) },
                            { label: "0°", run: () => onChange(setRotation(floor, selected, 0)) },
                        ].map(({ label, run }) => (
                            <Button key={label} variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={run}>
                                {label}
                            </Button>
                        ))}
                    </div>
                </div>
            )}

            {(office || door || fixture) && (
                <Field label="Libellé">
                    <Input
                        value={(office?.label ?? door?.label ?? fixture?.label) || ""}
                        onChange={(e) => set({ label: e.target.value || (fixture ? undefined : "") })}
                        className="h-8"
                    />
                </Field>
            )}

            {rack && (
                <>
                    <Field label="Rangée adressable">
                        <Select
                            value={rack.row ?? NONE}
                            onValueChange={(value) => set({ row: value === NONE ? null : (value as PlanRow) })}
                        >
                            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value={NONE}>Aucune (dessin seul)</SelectItem>
                                {freeRows(floor, rack.row).map((row) => (
                                    <SelectItem key={row} value={row}>
                                        {row} — {PLAN_ROW_LABELS[row]}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field label="Type de rack">
                        <Select
                            value={rack.style ?? "pallet"}
                            onValueChange={(value) => set({ style: value })}
                        >
                            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="pallet">Rack à palettes</SelectItem>
                                <SelectItem value="shoes">Étagère à chaussures</SelectItem>
                            </SelectContent>
                        </Select>
                    </Field>
                </>
            )}

            {wall && (
                <>
                    <Field label="Couleur">
                        <Select value={wall.tone} onValueChange={(value) => set({ tone: value })}>
                            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="white">Blanche</SelectItem>
                                <SelectItem value="black">Noire</SelectItem>
                            </SelectContent>
                        </Select>
                    </Field>
                    <div className="flex items-center justify-between">
                        <Label htmlFor="plan-wall-mural" className="text-xs text-muted-foreground">
                            Fresque « NOKK_PROJECT »
                        </Label>
                        <Switch
                            id="plan-wall-mural"
                            checked={wall.mural}
                            onCheckedChange={(checked) => set({ mural: checked })}
                        />
                    </div>
                </>
            )}

            <div className="flex flex-wrap gap-2">
                {(RECT_KINDS.has(selected.kind) || segment) && (
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={onRotate}>
                        <RotateCw size={13} aria-hidden />
                        Quart de tour
                    </Button>
                )}
                {!FIXED_KINDS.has(selected.kind) && (
                    <Button variant="destructive" size="sm" className="gap-1.5" onClick={onRemove}>
                        <Trash2 size={13} aria-hidden />
                        Retirer
                    </Button>
                )}
            </div>
            {rack?.row && (
                <p className="text-xs text-muted-foreground">
                    Retirer ce rack du plan ne supprime ni ses emplacements ni les balles qui y
                    sont rangées : ils réapparaissent dès qu'un rack reprend la rangée {rack.row}.
                </p>
            )}
        </div>
    )
}
