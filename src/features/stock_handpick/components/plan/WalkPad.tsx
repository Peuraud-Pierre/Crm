import type { ReactNode } from "react"
import { ArrowDown, ArrowUp, RotateCcw, RotateCw, Zap } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import type { WalkKey } from "./scene/walkMode"

interface WalkPadProps {
    onKey: (key: WalkKey, down: boolean) => void
}

/**
 * Pavé posé sur la vue 3D pendant la promenade, pour la souris et le
 * tactile : avancer, reculer, tourner, courir. Maintenir un bouton agit, le
 * relâcher arrête. Le regard se tourne aussi en glissant sur la vue.
 */
export function WalkPad({ onKey }: WalkPadProps) {
    const hold = (key: WalkKey, label: string, icon: ReactNode, className?: string) => (
        <button
            type="button"
            aria-label={label}
            className={cn(
                "flex h-11 w-11 touch-none select-none items-center justify-center rounded-xl border border-border bg-background/85 text-foreground shadow-sm backdrop-blur-sm transition-colors duration-base active:bg-primary active:text-primary-foreground",
                className,
            )}
            onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId)
                onKey(key, true)
            }}
            onPointerUp={() => onKey(key, false)}
            onPointerCancel={() => onKey(key, false)}
            onContextMenu={(event) => event.preventDefault()}
        >
            {icon}
        </button>
    )

    return (
        <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-end justify-between">
            <div className="pointer-events-auto grid grid-cols-3 gap-1">
                <span />
                {hold("forward", "Avancer", <ArrowUp size={18} />)}
                <span />
                {hold("turnLeft", "Tourner à gauche", <RotateCcw size={18} />)}
                {hold("back", "Reculer", <ArrowDown size={18} />)}
                {hold("turnRight", "Tourner à droite", <RotateCw size={18} />)}
            </div>
            <div className="pointer-events-auto">
                {hold("run", "Courir (maintenir)", <Zap size={18} />, "h-12 w-12 rounded-full")}
            </div>
        </div>
    )
}
