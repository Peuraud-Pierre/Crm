import { AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"

/**
 * Erreur d'un bloc de la page Matomo, avec sa reprise. Chaque panneau charge
 * indépendamment : l'erreur reste dans le panneau concerné, le reste vit.
 */
export default function BlockError({
    error,
    onRetry,
    retrying = false,
}: {
    error: unknown
    onRetry: () => void
    retrying?: boolean
}) {
    const message =
        error instanceof Error ? error.message : "Erreur inattendue."

    return (
        <div
            role="alert"
            className="flex flex-col items-start gap-3 rounded-md border border-destructive/30 bg-destructive-light p-4"
        >
            <p className="flex items-start gap-2 text-sm text-destructive">
                <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
                <span className="min-w-0 break-words">{message}</span>
            </p>
            <Button
                size="sm"
                variant="outline"
                onClick={onRetry}
                loading={retrying}
            >
                {!retrying && <RefreshCw aria-hidden />}
                Réessayer
            </Button>
        </div>
    )
}
