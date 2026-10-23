import { MessagesSquare, Users } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { EmptyState } from "@/shared/ui/molecules/empty-state"

/**
 * Écran d'accueil de la messagerie, quand aucune conversation n'est ouverte.
 *
 * `variant="default"` et non `"search"` : l'état est celui du chargement, pas
 * le résultat d'un filtre (DESIGN_SYSTEM.md §13.8).
 */
export function ChatEmptyState({
    onShowConversations,
}: {
    onShowConversations: () => void
}) {
    return (
        <div className="flex h-full flex-col items-center justify-center">
            <EmptyState
                icon={MessagesSquare}
                title="Sélectionnez une conversation"
                description="Choisissez un contact ou un groupe pour commencer à discuter. Vos messages sont chiffrés de bout en bout."
            />
            {/* Sur mobile la liste est masquée : sans ce raccourci, l'écran
                vide est sans issue. */}
            <Button onClick={onShowConversations} className="lg:hidden">
                <Users className="h-4 w-4" />
                Voir les conversations
            </Button>
        </div>
    )
}
