import { Link } from "react-router"
import { Settings } from "lucide-react"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { Button } from "@/shared/ui/atoms/button"
import { SkeletonCard, SkeletonText } from "@/shared/ui/molecules/skeleton-presets"
import { IdentityPanel } from "../components/identity/IdentityPanel"

/**
 * Page « Mon profil » — l'identité de l'utilisateur (photo, nom,
 * coordonnées, rôle). Tout ce qui relève du **comportement** de
 * l'application (sécurité, préférences, intégrations) vit dans l'espace
 * Paramètres, `/settings` (`features/settings`).
 */
export default function Profile() {
    const { user } = useAuth()

    // Le profil arrive avec la session : squelette tant qu'il n'est pas là.
    if (!user) {
        return (
            <div className="flex-1 space-y-6 p-4 sm:p-6">
                <SkeletonText lines={2} label="Chargement du profil…" />
                <SkeletonCard lines={6} label="Chargement du profil…" />
            </div>
        )
    }

    return (
        <div className="flex-1 space-y-6 p-4 sm:p-6 animate-in fade-in slide-in-from-bottom-2 duration-slow ease-out">
            <header className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-xl font-bold tracking-tight">
                        Mon profil
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Votre identité dans l'application — photo, nom et
                        coordonnées.
                    </p>
                </div>

                <Button variant="outline" size="sm" asChild>
                    <Link to="/settings">
                        <Settings className="mr-2 h-4 w-4" />
                        Paramètres
                    </Link>
                </Button>
            </header>

            <IdentityPanel user={user} />
        </div>
    )
}
