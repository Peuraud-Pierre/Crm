import type { LucideIcon } from "lucide-react"
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/shared/ui/atoms/card"
import type { Entity } from "../../types"
import { PermissionChip } from "../shared/PermissionChip"

// Aperçu limité : le détail complet vit dans la fiche (EntitySheet).
const PREVIEW_COUNT = 4

/**
 * Carte compacte d'un rôle/service — une entrée de navigation vers sa fiche
 * d'accès : pastille, nom, effectif, aperçu des premières permissions.
 */
export function EntityCard({
    entity,
    icon: Icon,
    userCount,
    onOpen,
}: {
    entity: Entity
    icon: LucideIcon
    userCount: number
    onOpen: () => void
}) {
    const preview = entity.permissions.slice(0, PREVIEW_COUNT)
    const rest = entity.permissions.length - preview.length

    return (
        <Card
            onClick={onOpen}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    onOpen()
                }
            }}
            variant="interactive"
            aria-label={`Ouvrir la fiche de ${entity.nom}`}
        >
            <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                    <div className="shrink-0 rounded-xl bg-primary/10 p-2.5 text-primary ring-1 ring-primary/20">
                        <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                        <CardTitle className="truncate text-base">
                            {entity.nom}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                            {userCount} utilisateur{userCount > 1 ? "s" : ""} ·{" "}
                            {entity.permissions.length} permission
                            {entity.permissions.length > 1 ? "s" : ""}
                        </p>
                    </div>
                </div>
            </CardHeader>

            <CardContent>
                {entity.permissions.length === 0 ? (
                    <p className="text-sm italic text-muted-foreground">
                        Aucune permission attribuée.
                    </p>
                ) : (
                    <div className="flex flex-wrap gap-1.5">
                        {preview.map((perm) => (
                            <PermissionChip
                                key={perm.id}
                                permission={perm}
                                variant="plain"
                            />
                        ))}
                        {rest > 0 && (
                            <span className="inline-flex items-center rounded-full border border-dashed border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                                +{rest}
                            </span>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
