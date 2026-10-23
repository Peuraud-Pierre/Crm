import { useRef, useState } from "react"
import { ImageUp, Layers, Loader2, Maximize2, Move, Trash2 } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"
import { Slider } from "@/shared/ui/atoms/slider"
import { Skeleton } from "@/shared/ui/atoms/skeleton"
import type { FondApi } from "@/features/magasins/hooks/data/useFond"
import type { Etage, FondCalage } from "@/features/magasins/types/magasin.types"
import type { Bounds } from "@/features/magasins/utils/planGeometry"

const ACCEPT = "application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"

interface FondPanelProps {
    /** Étage affiché : son plan importé et son calage. */
    etage: Etage
    /** Cadre du magasin, pour « Ajuster au magasin ». */
    bounds: Bounds
    fond: FondApi
    canEdit: boolean
    /** Le plan importé est affiché sous le plan 2D. */
    visible: boolean
    onToggleVisible: () => void
    /** Calage à la souris sur le plan (glisser, poignée du coin). */
    adjusting: boolean
    onToggleAdjust: () => void
}

type Field = "fond_x" | "fond_y" | "fond_largeur" | "fond_profondeur"

const FIELDS: { key: Field; label: string }[] = [
    { key: "fond_x", label: "X (m)" },
    { key: "fond_y", label: "Y (m)" },
    { key: "fond_largeur", label: "Largeur (m)" },
    { key: "fond_profondeur", label: "Profondeur (m)" },
]

const round = (v: number) => Math.round(v * 100) / 100

/**
 * Plan importé du magasin (PDF ou photo), rangé en petite vignette sur le
 * côté du plan. « Mettre en fond » l'affiche sous le plan 2D, calé en mètres,
 * pour décalquer zones et portants (« Modifier le plan », puis « Dessiner une
 * zone »). Changer la largeur garde les proportions du plan importé.
 */
export function FondPanel({ etage, bounds, fond, canEdit, visible, onToggleVisible, adjusting, onToggleAdjust }: FondPanelProps) {
    const inputRef = useRef<HTMLInputElement>(null)
    const [opacity, setOpacity] = useState<number | null>(null)

    const pick = (files: FileList | null) => {
        const file = files?.[0]
        if (file) void fond.upload(file)
        if (inputRef.current) inputRef.current.value = ""
    }

    const fileInput = (
        <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => pick(e.target.files)} />
    )

    if (!fond.hasFond) {
        if (!canEdit) return null
        return (
            <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed border-border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Importez le plan du magasin (PDF ou photo) pour le décalquer.</p>
                <Button variant="outline" size="sm" disabled={fond.busy} onClick={() => inputRef.current?.click()}>
                    {fond.busy ? <Loader2 size={14} className="animate-spin" /> : <ImageUp size={14} />}
                    Importer un plan
                </Button>
                {fileInput}
            </div>
        )
    }

    const { fond_x, fond_y, fond_largeur, fond_profondeur } = etage
    const ratio = fond_largeur && fond_profondeur ? fond_largeur / fond_profondeur : 1

    // Une largeur ou une profondeur saisie entraîne l'autre : le plan importé
    // garde ses proportions, sans quoi le décalque serait faux.
    const commit = (key: Field, raw: string) => {
        const value = Number(raw.replace(",", "."))
        if (!Number.isFinite(value) || value === etage[key]) return
        const size = Math.max(0.5, value)
        const patch: Partial<FondCalage> = { [key]: round(key === "fond_x" || key === "fond_y" ? value : size) }
        if (key === "fond_largeur") patch.fond_profondeur = round(size / ratio)
        if (key === "fond_profondeur") patch.fond_largeur = round(size * ratio)
        void fond.setCalage(patch)
    }

    const fit = () => {
        const width = Math.min(bounds.width, bounds.depth * ratio)
        void fond.setCalage({ fond_x: 0, fond_y: 0, fond_largeur: round(width), fond_profondeur: round(width / ratio) })
    }

    return (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Plan importé</p>

            {fond.imageUrl ? (
                <img
                    src={fond.imageUrl}
                    alt="Plan importé du magasin"
                    className="max-h-40 w-full rounded-md border border-border bg-background object-contain"
                />
            ) : (
                <Skeleton aria-hidden className="h-32 w-full rounded-md" />
            )}

            <Button variant={visible ? "default" : "outline"} size="sm" aria-pressed={visible} onClick={onToggleVisible}>
                <Layers size={14} />
                {visible ? "Retirer du fond" : "Mettre en fond pour décalquer"}
            </Button>

            {canEdit && visible && (
                <>
                    <Button
                        variant={adjusting ? "default" : "outline"}
                        size="sm"
                        aria-pressed={adjusting}
                        onClick={onToggleAdjust}
                    >
                        <Move size={14} />
                        {adjusting ? "Terminer l'ajustement" : "Ajuster sur le plan"}
                    </Button>
                    {adjusting && (
                        <p className="text-xs text-primary">
                            Glissez le plan pour le placer, tirez la poignée du coin bas-droit pour l'agrandir ou le
                            réduire (proportions gardées).
                        </p>
                    )}
                    <div className="flex flex-col gap-1.5">
                        <Label className="text-xs text-muted-foreground">Opacité</Label>
                        <Slider
                            min={0.1}
                            max={1}
                            step={0.05}
                            value={[opacity ?? etage.fond_opacite]}
                            onValueChange={([v]) => setOpacity(v)}
                            onValueCommit={([v]) => {
                                void fond.setCalage({ fond_opacite: round(v) }).then(() => setOpacity(null))
                            }}
                        />
                    </div>
                    {/* `key` : les champs repartent des valeurs enregistrées après chaque réglage. */}
                    <div key={`${fond_x}-${fond_y}-${fond_largeur}-${fond_profondeur}`} className="grid grid-cols-2 gap-2">
                        {FIELDS.map((f) => (
                            <div key={f.key} className="flex flex-col gap-1">
                                <Label htmlFor={f.key} className="text-xs text-muted-foreground">
                                    {f.label}
                                </Label>
                                <Input
                                    id={f.key}
                                    inputMode="decimal"
                                    className="h-8"
                                    defaultValue={etage[f.key] ?? ""}
                                    onBlur={(e) => commit(f.key, e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") commit(f.key, e.currentTarget.value)
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                    <Button variant="outline" size="sm" onClick={fit}>
                        <Maximize2 size={14} /> Ajuster au magasin
                    </Button>
                    <p className="text-xs text-muted-foreground">
                        Calez le plan sur un mur dont vous connaissez la cote, puis « Modifier le plan » et « Dessiner une
                        zone » pour décalquer.
                    </p>
                </>
            )}

            {canEdit && (
                <div className="flex flex-wrap gap-1">
                    <Button variant="ghost" size="sm" disabled={fond.busy} onClick={() => inputRef.current?.click()}>
                        {fond.busy ? <Loader2 size={14} className="animate-spin" /> : <ImageUp size={14} />}
                        Remplacer
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => void fond.remove()}>
                        <Trash2 size={14} /> Supprimer
                    </Button>
                    {fileInput}
                </div>
            )}
        </div>
    )
}
