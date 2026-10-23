import { useMemo, useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { Skeleton } from "@/shared/ui/atoms/skeleton"
import { useUserPermissions } from "../../hooks/data/useUserPermissions"
import { groupByCategory } from "../../utils/groupByCategory"
import type { AdminProfile } from "../../types"
import { categoryLabel } from "../shared/categoryLabels"
import { FicheSection } from "../shared/FicheSection"
import { PermissionChip } from "../shared/PermissionChip"
import { PermissionPickerDialog } from "../shared/PermissionPickerDialog"
import { SkeletonGroup } from "@/shared/ui/molecules/skeleton-presets"

/**
 * Section « Permissions » de la fiche utilisateur : individuelles
 * (ajout/retrait si canManage) puis héritées du rôle/service (lecture seule).
 * Rendu pur — la logique data vit dans useUserPermissions.
 */
export function UserPermissionsSection({
    user,
    canManage,
}: {
    user: AdminProfile
    canManage: boolean
}) {
    const {
        inheritedPerms,
        effectiveIndividualPerms,
        availablePerms,
        addPermissions,
        removePermission,
        loading,
    } = useUserPermissions(user.user_id, user.role_id, user.service_id)

    const [pickerOpen, setPickerOpen] = useState(false)

    const individualGrouped = useMemo(
        () => groupByCategory(effectiveIndividualPerms),
        [effectiveIndividualPerms]
    )
    const inheritedGrouped = useMemo(
        () => groupByCategory(inheritedPerms),
        [inheritedPerms]
    )

    return (
        <FicheSection
            title="Permissions"
            action={
                canManage && (
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setPickerOpen(true)}
                        disabled={loading}
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        Ajouter
                    </Button>
                )
            }
        >
            {loading ? (
                <SkeletonGroup
                    className="space-y-3"
                    label="Chargement des permissions…"
                >
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                </SkeletonGroup>
            ) : (
                <div className="space-y-5">
                    <div>
                        <h4 className="mb-2 text-sm font-semibold">
                            Accordées individuellement
                        </h4>
                        {effectiveIndividualPerms.length === 0 ? (
                            <p className="text-sm italic text-muted-foreground">
                                Aucune permission individuelle.
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {individualGrouped.map((g) => (
                                    <div key={g.label}>
                                        <p className="mb-1 text-xs font-medium text-muted-foreground">
                                            {categoryLabel(g.label)}
                                        </p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {g.perms.map((p) => (
                                                <PermissionChip
                                                    key={p.id}
                                                    permission={p}
                                                    variant="individual"
                                                    onRemove={
                                                        canManage
                                                            ? () =>
                                                                  removePermission(
                                                                      p.id
                                                                  )
                                                            : undefined
                                                    }
                                                />
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div>
                        <h4 className="mb-2 text-sm font-semibold">
                            Héritées du rôle / service
                        </h4>
                        {inheritedPerms.length === 0 ? (
                            <p className="text-sm italic text-muted-foreground">
                                Aucune permission héritée.
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {inheritedGrouped.map((g) => (
                                    <div key={g.label}>
                                        <p className="mb-1 text-xs font-medium text-muted-foreground">
                                            {categoryLabel(g.label)}
                                        </p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {g.perms.map((p) => (
                                                <PermissionChip
                                                    key={p.id}
                                                    permission={p}
                                                    variant="inherited"
                                                />
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            <PermissionPickerDialog
                open={pickerOpen}
                onOpenChange={setPickerOpen}
                entityName={user.full_name || "cet utilisateur"}
                availablePerms={availablePerms}
                onConfirm={addPermissions}
            />
        </FicheSection>
    )
}
