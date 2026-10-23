"use client"

import { AlertTriangle } from "lucide-react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/shared/ui/atoms/card"
import { menuItems } from "@/shared/components/layout/menuItems"
import type { MaintenanceWindow } from "../types/maintenance.types"

/**
 * Écran affiché à la place du contenu quand une maintenance est en cours.
 *
 * Sert les deux portées : coupure globale de l'application, ou coupure
 * d'une seule feature. Dans le second cas le libellé nomme la feature —
 * l'utilisateur doit comprendre que le reste de l'application fonctionne.
 */
export function MaintenanceScreen({
    window: maintenance,
}: {
    window: MaintenanceWindow
}) {
    const isFeatureScope = maintenance.scope === "feature"

    // `feature_key` est le `title` d'une entrée de menuItems — le registre
    // central des features. On en tire le libellé affichable ; une clé
    // devenue obsolète retombe sur la clé brute plutôt que sur du vide.
    const featureLabel = isFeatureScope
        ? (menuItems.find((i) => i.title === maintenance.feature_key)
              ?.displayName ?? maintenance.feature_key)
        : null

    return (
        <div className="flex flex-1 items-center justify-center bg-muted/20 p-6">
            <Card className="w-full max-w-xl p-8 text-center">
                <CardHeader>
                    <CardTitle className="flex flex-col items-center gap-2 text-2xl font-semibold">
                        <AlertTriangle className="size-8 text-warning" />
                        {isFeatureScope
                            ? `${featureLabel} est en maintenance`
                            : "Le site est en maintenance"}
                    </CardTitle>
                </CardHeader>

                <CardContent className="space-y-4">
                    <p className="text-muted-foreground">
                        {isFeatureScope
                            ? "Ce module est momentanément indisponible. Le reste de l'application reste accessible."
                            : "Nous effectuons actuellement une maintenance programmée."}
                    </p>

                    <p className="text-sm">
                        Démarrée le{" "}
                        <span className="font-medium">
                            {format(
                                new Date(maintenance.starts_at),
                                "d MMMM yyyy 'à' HH'h'mm",
                                { locale: fr }
                            )}
                        </span>
                    </p>

                    {maintenance.ends_at && (
                        <p className="text-sm">
                            Rétablissement prévu le{" "}
                            <span className="font-medium">
                                {format(
                                    new Date(maintenance.ends_at),
                                    "d MMMM yyyy 'à' HH'h'mm",
                                    { locale: fr }
                                )}
                            </span>
                        </p>
                    )}

                    {maintenance.message && (
                        <div className="rounded-xl bg-muted p-4">
                            <p className="text-sm">{maintenance.message}</p>
                        </div>
                    )}

                    <p className="pt-4 text-xs text-muted-foreground">
                        Merci de votre patience.
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}

export default MaintenanceScreen
