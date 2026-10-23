import { useNavigate } from "react-router"
import { Briefcase, Shield, User } from "lucide-react"
import { Badge, badgeVariants } from "@/shared/ui/atoms/badge"
import { cn } from "@/shared/lib/utils"
import { ADMIN_TABS } from "../../constants"
import type { PermissionHolders as Holders } from "../../types"

/** Résumé compact pour une ligne de catalogue — pas de navigation. */
export function PermissionHoldersSummary({
    holders,
}: {
    holders: Holders | null
}) {
    const count =
        (holders?.roles.length ?? 0) + (holders?.services.length ?? 0)

    if (count === 0) {
        return (
            <Badge className="bg-warning-light text-warning shrink-0 text-xs">
                Non attribuée
            </Badge>
        )
    }

    return (
        <Badge variant="outline" className="shrink-0 text-xs">
            {count} détenteur{count > 1 ? "s" : ""}
        </Badge>
    )
}

/**
 * Détenteurs d'une permission : badges des rôles et services qui l'accordent
 * (cliquables → fiche de l'entité) + compteur d'attributions individuelles.
 */
export function PermissionHolders({ holders }: { holders: Holders | null }) {
    const navigate = useNavigate()

    const roles = holders?.roles ?? []
    const services = holders?.services ?? []
    const userCount = holders?.userCount ?? 0

    if (roles.length === 0 && services.length === 0 && userCount === 0) {
        return (
            <Badge className="bg-warning-light text-warning shrink-0 text-xs">
                Non attribuée
            </Badge>
        )
    }

    return (
        <div className="flex flex-wrap items-center gap-1.5">
            {roles.map((role) => (
                <button
                    key={role.id}
                    type="button"
                    onClick={() =>
                        navigate(
                            `/administration/${ADMIN_TABS.roles}?fiche=${role.id}`
                        )
                    }
                    aria-label={`Ouvrir la fiche du rôle ${role.nom}`}
                    className={cn(
                        badgeVariants({ variant: "secondary" }),
                        "flex cursor-pointer items-center gap-1 text-xs"
                    )}
                >
                    <Shield className="h-3 w-3" aria-hidden="true" />
                    {role.nom}
                </button>
            ))}
            {services.map((service) => (
                <button
                    key={service.id}
                    type="button"
                    onClick={() =>
                        navigate(
                            `/administration/${ADMIN_TABS.services}?fiche=${service.id}`
                        )
                    }
                    aria-label={`Ouvrir la fiche du service ${service.nom}`}
                    className={cn(
                        badgeVariants({ variant: "outline" }),
                        "flex cursor-pointer items-center gap-1 text-xs"
                    )}
                >
                    <Briefcase className="h-3 w-3" aria-hidden="true" />
                    {service.nom}
                </button>
            ))}
            {userCount > 0 && (
                <Badge
                    variant="outline"
                    className="flex items-center gap-1 text-xs text-muted-foreground"
                >
                    <User className="h-3 w-3" aria-hidden="true" />+{userCount}{" "}
                    utilisateur{userCount > 1 ? "s" : ""} en individuel
                </Badge>
            )}
        </div>
    )
}
