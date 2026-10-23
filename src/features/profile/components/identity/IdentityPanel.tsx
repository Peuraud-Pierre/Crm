import { Briefcase, CalendarClock, ShieldCheck } from "lucide-react"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/shared/ui/atoms/card"
import { Badge } from "@/shared/ui/atoms/badge"
import { Skeleton } from "@/shared/ui/atoms/skeleton"
import { StatTile } from "@/shared/components/misc/StatTile"
import type { AppUser } from "@/features/auth/hooks/useAuth/types"
import { useProfileDetails } from "../../hooks/data/useProfileDetails"
import { IdentityForm } from "./IdentityForm"
import { SkeletonGroup } from "@/shared/ui/molecules/skeleton-presets"

interface IdentityPanelProps {
    user: NonNullable<AppUser>
}

function formatDate(value?: string | null): string {
    return value ? new Date(value).toLocaleDateString("fr-FR") : "—"
}

export function IdentityPanel({ user }: IdentityPanelProps) {
    const { details, loading } = useProfileDetails()
    const isActive = user.status === "active"

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <StatTile
                    icon={CalendarClock}
                    label="Dernière connexion"
                    value={formatDate(user.last_login)}
                    index={0}
                />
                <StatTile
                    icon={ShieldCheck}
                    label="Statut du compte"
                    value={isActive ? "Actif" : "Inactif"}
                    tone={isActive ? "success" : "warning"}
                    index={1}
                />
                <StatTile
                    icon={Briefcase}
                    label="Rôle"
                    value={user.role || "—"}
                    index={2}
                />
            </div>

            <Card>
                <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <CardTitle>Informations personnelles</CardTitle>
                            <CardDescription>
                                Membre depuis le{" "}
                                {formatDate(details.created_at)}.
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            {user.role && (
                                <Badge variant="secondary">{user.role}</Badge>
                            )}
                            {user.service && (
                                <Badge variant="outline">{user.service}</Badge>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <SkeletonGroup
                            className="space-y-4"
                            label="Chargement de l'identité…"
                        >
                            <Skeleton className="h-20 w-20 rounded-full" />
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                        </SkeletonGroup>
                    ) : (
                        <IdentityForm user={user} phone={details.phone} />
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
