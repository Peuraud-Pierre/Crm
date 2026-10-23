import { EyeOff } from "lucide-react"
import { EmptyState } from "@/shared/ui/molecules/empty-state"

/**
 * Journal des visites désactivé dans les réglages Matomo du site. Un état, pas
 * une erreur : pas de « Réessayer », qui ne changerait rien à un réglage.
 */
export default function VisitsLogDisabled() {
    return (
        <EmptyState
            size="sm"
            icon={EyeOff}
            title="Journal des visites désactivé"
            description="Le journal des visites est désactivé dans Matomo pour ce site. Un administrateur Matomo peut le réactiver dans les réglages du site."
        />
    )
}
