import { FileCheck2 } from "lucide-react"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/shared/ui/atoms/card"
import { Badge } from "@/shared/ui/atoms/badge"
import { Skeleton } from "@/shared/ui/atoms/skeleton"
import {
    PRIVACY_VERSION,
    PRIVACY_VERSION_LABEL,
} from "@/shared/components/legal/legalContent"

interface PrivacyConsentCardProps {
    acceptedAt: string | null
    acceptedVersion: string | null
    loading: boolean
}

/**
 * Traçabilité du consentement aux conditions. En lecture seule : une
 * version obsolète déclenche automatiquement le dialogue d'acceptation
 * monté par MainLayout, il n'y a rien à faire depuis cette page.
 */
export function PrivacyConsentCard({
    acceptedAt,
    acceptedVersion,
    loading,
}: PrivacyConsentCardProps) {
    const upToDate = acceptedVersion === PRIVACY_VERSION

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <FileCheck2 className="h-5 w-5" />
                    Conditions d'utilisation
                </CardTitle>
                <CardDescription>
                    Version en vigueur : {PRIVACY_VERSION_LABEL}.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <Skeleton className="h-6 w-64" />
                ) : (
                    <div className="flex flex-wrap items-center gap-3">
                        <Badge variant={upToDate ? "default" : "secondary"}>
                            {upToDate ? "À jour" : "Acceptation requise"}
                        </Badge>
                        <p className="text-sm text-muted-foreground">
                            {acceptedAt
                                ? `Acceptées le ${new Date(
                                      acceptedAt
                                  ).toLocaleDateString("fr-FR")}${
                                      acceptedVersion
                                          ? ` (version ${acceptedVersion})`
                                          : ""
                                  }.`
                                : "Vous n'avez pas encore accepté les conditions."}
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
