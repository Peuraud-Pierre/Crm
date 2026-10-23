import { RefreshCw } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { cn } from "@/shared/lib/utils"

interface RefreshButtonProps {
    loading: boolean
    onClick: () => void
    /** Complète « Rafraîchir … » pour l'étiquette d'accessibilité. */
    label: string
}

/**
 * Bouton de rafraîchissement dont l'icône tourne pendant le chargement.
 *
 * Avant, seul `disabled` changeait : sur une requête rapide, l'utilisateur
 * n'avait aucun retour visuel et pouvait croire que son clic n'avait rien fait.
 */
export function RefreshButton({ loading, onClick, label }: RefreshButtonProps) {
    return (
        <Button
            variant="outline"
            size="sm"
            onClick={onClick}
            disabled={loading}
            aria-label={`Rafraîchir ${label}`}
        >
            <RefreshCw
                className={cn("h-4 w-4 transition-transform", loading && "animate-spin")}
            />
        </Button>
    )
}
