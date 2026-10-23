import { LoadingSpinner } from "./loading-spinner"
import { cn } from "@/shared/lib/utils"

interface LoadingScreenProps {
    message?: string
    className?: string
}

/**
 * Écran de chargement plein écran.
 *
 * `role="status"` + `aria-busy` : sans eux, un lecteur d'écran ne signale
 * rien pendant l'attente. Le spinner porte `aria-hidden` — c'est le libellé
 * qui est annoncé, pas la décoration.
 */
export function LoadingScreen({
    message = "Chargement…",
    className,
}: LoadingScreenProps) {
    return (
        <div
            role="status"
            aria-busy="true"
            className={cn(
                "flex min-h-screen flex-1 flex-col items-center justify-center bg-background",
                className
            )}
        >
            <div className="space-y-4 text-center">
                <div aria-hidden>
                    <LoadingSpinner size="lg" />
                </div>
                <p className="text-sm text-muted-foreground">{message}</p>
            </div>
        </div>
    )
}
