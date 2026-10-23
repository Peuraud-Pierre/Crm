import { RefreshCw } from "lucide-react"

import { Button } from "@/shared/ui/atoms/button"
import { reloadNow, useUpdateAvailable } from "@/shared/lib/appUpdate"

/**
 * Bandeau annonçant une nouvelle version.
 *
 * Il n'apparaît que si le rechargement a été retenu : sans saisie en cours,
 * `notifyUpdateAvailable` recharge directement et personne ne le voit. Sa
 * présence signifie donc toujours « votre saisie retient la mise à jour ».
 */
export function UpdateBanner() {
    const updateAvailable = useUpdateAvailable()

    if (!updateAvailable) return null

    return (
        <div
            role="status"
            aria-live="polite"
            className="fixed inset-x-0 bottom-0 z-50 flex flex-wrap items-center justify-center gap-3 border-t bg-card/95 px-4 py-3 shadow-lg backdrop-blur"
        >
            <p className="text-sm text-card-foreground">
                Une nouvelle version est disponible. Elle s'appliquera dès que
                votre saisie sera enregistrée.
            </p>
            <Button size="sm" className="gap-2" onClick={reloadNow}>
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Recharger maintenant
            </Button>
        </div>
    )
}
