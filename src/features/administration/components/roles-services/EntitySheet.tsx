import { useMemo, useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/shared/ui/atoms/alert-dialog"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import { Separator } from "@/shared/ui/atoms/separator"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/shared/ui/atoms/sheet"
import { formatDate } from "../../utils/format"
import { groupByCategory } from "../../utils/groupByCategory"
import type { Entity, Permission } from "../../types"
import { categoryLabel } from "../shared/categoryLabels"
import { FicheSection } from "../shared/FicheSection"
import { PermissionChip } from "../shared/PermissionChip"
import { PermissionPickerDialog } from "../shared/PermissionPickerDialog"

interface EntitySheetProps {
    /** null = fermé. */
    entity: Entity | null
    icon: LucideIcon
    /** « rôle » ou « service » — pour les libellés. */
    entityWord: string
    nameLabel: string
    userCount: number
    countsLoading: boolean
    /** roles_services manquant → fiche en lecture seule. */
    canManage: boolean
    /** Catalogue moins les permissions déjà attribuées à l'entité. */
    availablePerms: Permission[]
    onClose: () => void
    onRename: (nom: string) => Promise<boolean>
    onDelete: () => Promise<boolean>
    onAddPermissions: (selected: Permission[]) => Promise<boolean>
    onRemovePermission: (permissionId: string) => void
}

/**
 * Fiche d'accès d'un rôle/service : identité, renommage inline, permissions
 * attribuées, suppression avec impact chiffré (« N utilisateurs perdront... »).
 */
export function EntitySheet({
    entity,
    icon: Icon,
    entityWord,
    nameLabel,
    userCount,
    countsLoading,
    canManage,
    availablePerms,
    onClose,
    onRename,
    onDelete,
    onAddPermissions,
    onRemovePermission,
}: EntitySheetProps) {
    const [pickerOpen, setPickerOpen] = useState(false)
    const [renaming, setRenaming] = useState(false)

    const grouped = useMemo(
        () => groupByCategory(entity?.permissions ?? []),
        [entity?.permissions]
    )

    async function handleRename(e: React.SubmitEvent<HTMLFormElement>) {
        e.preventDefault()
        if (!entity) return
        const nom = (
            (new FormData(e.currentTarget).get("nom") as string) ?? ""
        ).trim()
        if (!nom || nom === entity.nom) return
        setRenaming(true)
        await onRename(nom)
        setRenaming(false)
    }

    return (
        <Sheet
            open={!!entity}
            onOpenChange={(open) => {
                if (!open) onClose()
            }}
        >
            <SheetContent
                side="right"
                className="w-full overflow-y-auto sm:max-w-xl"
            >
                {entity && (
                    <>
                        <SheetHeader className="space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="shrink-0 rounded-xl bg-primary/10 p-2.5 text-primary ring-1 ring-primary/20">
                                    <Icon className="h-5 w-5" />
                                </div>
                                <div className="min-w-0 text-left">
                                    <SheetTitle className="truncate">
                                        {entity.nom}
                                    </SheetTitle>
                                    <SheetDescription>
                                        {/* Un <p> ne peut pas contenir de Skeleton (div). */}
                                        {countsLoading
                                            ? "…"
                                            : `${userCount} utilisateur${userCount > 1 ? "s" : ""}`}{" "}
                                        · {entity.permissions.length}{" "}
                                        permission
                                        {entity.permissions.length > 1
                                            ? "s"
                                            : ""}{" "}
                                        · créé le{" "}
                                        {formatDate(entity.created_at)}
                                    </SheetDescription>
                                </div>
                            </div>
                        </SheetHeader>

                        <div className="mt-6 space-y-6">
                            {canManage && (
                                <FicheSection title={nameLabel}>
                                    {/* key = resynchronise le champ non contrôlé
                                        quand on change d'entité ou après rename. */}
                                    <form
                                        key={`${entity.id}-${entity.nom}`}
                                        onSubmit={handleRename}
                                        className="flex gap-2"
                                    >
                                        <Input
                                            name="nom"
                                            defaultValue={entity.nom}
                                            aria-label={nameLabel}
                                            required
                                        />
                                        <Button
                                            type="submit"
                                            variant="outline"
                                            disabled={renaming}
                                        >
                                            {renaming
                                                ? "Renommage..."
                                                : "Renommer"}
                                        </Button>
                                    </form>
                                </FicheSection>
                            )}

                            <Separator />

                            <FicheSection
                                title="Permissions"
                                action={
                                    canManage && (
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={() => setPickerOpen(true)}
                                        >
                                            <Plus className="mr-2 h-4 w-4" />
                                            Ajouter
                                        </Button>
                                    )
                                }
                            >
                                {entity.permissions.length === 0 ? (
                                    <p className="text-sm italic text-muted-foreground">
                                        Aucune permission attribuée.
                                    </p>
                                ) : (
                                    <div className="space-y-3">
                                        {grouped.map((g) => (
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
                                                                          onRemovePermission(
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
                            </FicheSection>

                            {canManage && (
                                <>
                                    <Separator />
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <p className="text-sm text-muted-foreground">
                                            {userCount > 0
                                                ? `${userCount} utilisateur${userCount > 1 ? "s" : ""} perdron${userCount > 1 ? "t" : "a"} ce ${entityWord} et ses permissions.`
                                                : `Aucun utilisateur n'est rattaché à ce ${entityWord}.`}
                                        </p>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button
                                                    variant="destructive"
                                                    className="shrink-0"
                                                >
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Supprimer
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>
                                                        Supprimer «{" "}
                                                        {entity.nom} » ?
                                                    </AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Cette action est
                                                        irréversible.{" "}
                                                        {userCount > 0
                                                            ? `${userCount} utilisateur${userCount > 1 ? "s" : ""} perdron${userCount > 1 ? "t" : "a"} ce ${entityWord} et les ${entity.permissions.length} permission(s) associée(s).`
                                                            : "Aucun utilisateur n'est impacté."}
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>
                                                        Annuler
                                                    </AlertDialogCancel>
                                                    <AlertDialogAction
                                                        onClick={() =>
                                                            void onDelete()
                                                        }
                                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                    >
                                                        Supprimer
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </>
                            )}
                        </div>

                        <PermissionPickerDialog
                            open={pickerOpen}
                            onOpenChange={setPickerOpen}
                            entityName={entity.nom}
                            availablePerms={availablePerms}
                            onConfirm={onAddPermissions}
                        />
                    </>
                )}
            </SheetContent>
        </Sheet>
    )
}
