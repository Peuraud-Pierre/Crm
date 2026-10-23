import { Move, X } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"

interface BalleSelectionBarProps {
    count: number
    onMove: () => void
    onClear: () => void
    onDone: () => void
}

/**
 * Barre du mode sélection, fixée en bas de l'écran : visible quelle que soit
 * la hauteur défilée de l'inventaire, et à portée de pouce sur téléphone.
 */
export function BalleSelectionBar({ count, onMove, onClear, onDone }: BalleSelectionBarProps) {
    return (
        <div
            role="region"
            aria-label="Sélection de balles"
            className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 py-3 shadow-lg backdrop-blur"
        >
            <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2">
                <span className="mr-auto text-sm font-semibold tabular-nums">
                    {count === 0
                        ? "Touchez des balles pour les sélectionner"
                        : `${count} balle${count > 1 ? "s" : ""} sélectionnée${count > 1 ? "s" : ""}`}
                </span>
                {count > 0 && (
                    <Button variant="ghost" className="h-10" onClick={onClear}>
                        Tout désélectionner
                    </Button>
                )}
                <Button className="h-10 gap-1.5" onClick={onMove} disabled={count === 0}>
                    <Move size={14} aria-hidden />
                    Déplacer
                </Button>
                <Button variant="outline" className="h-10 gap-1.5" onClick={onDone}>
                    <X size={14} aria-hidden />
                    Terminer
                </Button>
            </div>
        </div>
    )
}
