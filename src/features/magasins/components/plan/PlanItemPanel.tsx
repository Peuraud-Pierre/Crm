import { ArrowDown, ArrowLeftRight, ArrowUp, Combine, RectangleHorizontal, RotateCcw, RotateCw, Spline, Ungroup, Undo2, X } from "lucide-react"
import { Badge } from "@/shared/ui/atoms/badge"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"
import { PLAN_KIND_LABEL } from "@/features/magasins/constants"
import type { PlanItem } from "@/features/magasins/types/magasin.types"
import { ZoneLinkSelect, type ZoneLink } from "./ZoneLinkSelect"
import { clampRect, rectOf, type Bounds, type Rect } from "@/features/magasins/utils/planGeometry"

interface PlanItemPanelProps {
    item: PlanItem
    /** Mannequin : sa zone de rattachement, modifiable. */
    zoneLink?: ZoneLink | null
    bounds: Bounds
    onClose: () => void
    /** Présents en mode édition seulement. */
    onRectChange?: (rect: Rect | null) => void
    onRotate?: (delta: number) => void
    /**
     * Mode « angles » de l'objet (en édition) : ses angles se glissent sur le
     * plan, comme le contour de l'étage. `reset` le ramène à un rectangle.
     */
    corners?: { on: boolean; toggle: () => void; reset: (() => void) | null } | null
    /** Escalier : fusion avec un autre, ou séparation de ses volées. */
    stairs?: {
        merging: boolean
        start: () => void
        ungroup: (() => void) | null
        descend: boolean
        setDescend: (descend: boolean) => void
    } | null
}

const FIELDS: { key: keyof Rect; label: string }[] = [
    { key: "x", label: "X (m)" },
    { key: "y", label: "Y (m)" },
    { key: "w", label: "Largeur (m)" },
    { key: "h", label: "Profondeur (m)" },
]

/**
 * Fiche de l'élément sélectionné sur le plan. En édition, elle permet aussi
 * une saisie au centimètre et la rotation par quart de tour ou par 15°.
 *
 * « Retirer du plan » garde l'élément (il retourne dans la palette « à
 * placer ») ; la suppression définitive est sous le plan, à droite.
 */
export function PlanItemPanel({ item, bounds, onClose, onRectChange, onRotate, corners, stairs, zoneLink }: PlanItemPanelProps) {
    const rect = rectOf(item.geometry)
    const editing = Boolean(onRectChange)

    return (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{PLAN_KIND_LABEL[item.kind]}</Badge>
                        {!item.is_active && <Badge variant="outline">Inactif</Badge>}
                    </div>
                    <p className="mt-1 truncate text-base font-semibold text-foreground">{item.path}</p>
                    {item.label && <p className="text-sm text-muted-foreground">{item.label}</p>}
                </div>
                <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fermer la fiche">
                    <X size={16} />
                </Button>
            </div>

            {zoneLink && <ZoneLinkSelect {...zoneLink} />}

            {!rect ? (
                <p className="text-sm text-muted-foreground">Pas encore placé sur le plan.</p>
            ) : editing ? (
                <>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {FIELDS.map((f) => (
                            <div key={f.key} className="flex flex-col gap-1">
                                <Label htmlFor={`plan-${f.key}`} className="text-xs text-muted-foreground">
                                    {f.label}
                                </Label>
                                <Input
                                    id={`plan-${f.key}`}
                                    type="number"
                                    step={0.1}
                                    min={0}
                                    value={rect[f.key]}
                                    onChange={(e) => {
                                        const value = Number(e.target.value)
                                        if (!Number.isFinite(value)) return
                                        onRectChange?.(clampRect({ ...rect, [f.key]: value }, bounds, item.geometry.rotation))
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Label htmlFor="plan-rotation" className="text-xs text-muted-foreground">
                            Rotation (°)
                        </Label>
                        {/* `key` : le champ suit la poignée de rotation. */}
                        <Input
                            key={`${item.key}-${item.geometry.rotation}`}
                            id="plan-rotation"
                            type="number"
                            step={1}
                            className="h-8 w-20"
                            defaultValue={item.geometry.rotation}
                            onBlur={(e) => {
                                const value = Number(e.target.value)
                                if (Number.isFinite(value) && value !== item.geometry.rotation) onRotate?.(value - item.geometry.rotation)
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") e.currentTarget.blur()
                            }}
                        />
                        <Button variant="outline" size="sm" onClick={() => onRotate?.(-15)} aria-label="Tourner de 15° à gauche">
                            <RotateCcw size={14} /> 15°
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => onRotate?.(15)} aria-label="Tourner de 15° à droite">
                            <RotateCw size={14} /> 15°
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => onRotate?.(90)} aria-label="Tourner d'un quart de tour">
                            <RotateCw size={14} /> 90°
                        </Button>
                    </div>
                </>
            ) : (
                <p className="text-sm text-muted-foreground">
                    {rect.w.toLocaleString("fr-FR")} × {rect.h.toLocaleString("fr-FR")} m, à ({rect.x.toLocaleString("fr-FR")} ;{" "}
                    {rect.y.toLocaleString("fr-FR")}){item.geometry.rotation ? `, tourné de ${item.geometry.rotation}°` : ""}
                </p>
            )}

            {editing && rect && (corners || item.type !== "equipement") && (
                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3">
                    {corners && (
                        <Button
                            variant={corners.on ? "default" : "outline"}
                            size="sm"
                            aria-pressed={corners.on}
                            disabled={Boolean(item.geometry.rotation)}
                            title={item.geometry.rotation ? "Remettez la rotation à 0° pour modifier les angles" : undefined}
                            onClick={corners.toggle}
                        >
                            <Spline size={14} /> {corners.on ? "Terminer les angles" : "Modifier les angles"}
                        </Button>
                    )}
                    {stairs && (
                        // Sens depuis cet étage : vers le haut, ou vers l'étage du dessous.
                        <div className="flex gap-1" role="radiogroup" aria-label="Sens de l'escalier">
                            {([false, true] as const).map((down) => (
                                <Button
                                    key={String(down)}
                                    variant={stairs.descend === down ? "default" : "outline"}
                                    size="sm"
                                    role="radio"
                                    aria-checked={stairs.descend === down}
                                    onClick={() => stairs.descend !== down && stairs.setDescend(down)}
                                >
                                    {down ? <ArrowDown size={14} /> : <ArrowUp size={14} />} {down ? "Descend" : "Monte"}
                                </Button>
                            ))}
                        </div>
                    )}
                    {stairs && (
                        <Button variant={stairs.merging ? "default" : "outline"} size="sm" aria-pressed={stairs.merging} onClick={stairs.start}>
                            <Combine size={14} /> {stairs.merging ? "Choisissez l'escalier…" : "Fusionner avec…"}
                        </Button>
                    )}
                    {stairs && onRotate && (
                        // Demi-tour : la flèche et la montée 3D partent de l'autre bout.
                        <Button variant="outline" size="sm" onClick={() => onRotate(180)}>
                            <ArrowLeftRight size={14} /> Inverser le sens
                        </Button>
                    )}
                    {stairs?.ungroup && (
                        <Button variant="ghost" size="sm" onClick={stairs.ungroup}>
                            <Ungroup size={14} /> Séparer
                        </Button>
                    )}
                    {corners?.reset && (
                        <Button variant="ghost" size="sm" onClick={corners.reset}>
                            <RectangleHorizontal size={14} /> Remettre en rectangle
                        </Button>
                    )}
                    {item.type !== "equipement" && (
                        <Button variant="ghost" size="sm" onClick={() => onRectChange?.(null)}>
                            <Undo2 size={14} /> Retirer du plan
                        </Button>
                    )}
                </div>
            )}
        </div>
    )
}
