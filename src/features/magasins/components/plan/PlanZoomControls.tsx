import { Maximize, ZoomIn, ZoomOut } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"

interface PlanZoomControlsProps {
    zoom: number
    onZoomIn: () => void
    onZoomOut: () => void
    onReset: () => void
}

/**
 * Boutons de zoom, SOUS le plan et non par-dessus : posés sur le dessin, ils
 * cachaient le coin bas-droit, et l'angle du contour qui s'y trouve ne
 * pouvait plus être attrapé. La molette zoome aussi.
 */
export function PlanZoomControls({ zoom, onZoomIn, onZoomOut, onReset }: PlanZoomControlsProps) {
    const whole = zoom <= 1.001
    return (
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
            <Button variant="ghost" size="icon" className="size-8" onClick={onZoomOut} disabled={whole} aria-label="Dézoomer">
                <ZoomOut size={16} />
            </Button>
            <span className="w-12 text-center text-xs tabular-nums text-muted-foreground" aria-live="polite">
                {Math.round(zoom * 100)} %
            </span>
            <Button variant="ghost" size="icon" className="size-8" onClick={onZoomIn} aria-label="Zoomer">
                <ZoomIn size={16} />
            </Button>
            <Button variant="ghost" size="icon" className="size-8" onClick={onReset} disabled={whole} aria-label="Voir tout le plan">
                <Maximize size={16} />
            </Button>
        </div>
    )
}
