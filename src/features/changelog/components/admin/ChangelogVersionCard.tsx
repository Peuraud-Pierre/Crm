"use client"

import { useMemo, useState } from "react"
import {
    Archive,
    Calendar,
    ChevronDown,
    ChevronUp,
    Eye,
    FileEdit,
    Pencil,
    Send,
    Trash,
} from "lucide-react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
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
import { Badge } from "@/shared/ui/atoms/badge"
import { Button } from "@/shared/ui/atoms/button"
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/shared/ui/atoms/card"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/shared/ui/atoms/dialog"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import {
    CHANGELOG_DIALOG_SIZE,
    CHANGELOG_PERMISSIONS,
} from "../../constants"
import { useChangelogContext } from "../../hooks/context/ChangelogProvider"
import { groupItemsByCategory } from "../../utils/groupItems"
import type { ChangelogVersionWithItems } from "../../types/changelog.types"
import { CategorySection } from "../CategorySection"
import { ChangelogForm } from "./ChangelogForm"

const STATUS_CONFIG = {
    draft: {
        label: "Brouillon",
        variant: "secondary" as const,
        icon: FileEdit,
    },
    published: { label: "Publié", variant: "default" as const, icon: Eye },
    archived: { label: "Archivé", variant: "outline" as const, icon: Archive },
}

interface Props {
    version: ChangelogVersionWithItems
    collapsible?: boolean
}

/**
 * Une version dans la console d'administration : statut, actions de
 * cycle de vie (publier / archiver), édition et suppression.
 *
 * Le rendu du contenu réutilise `CategorySection`, partagé avec la
 * timeline publique — l'ancien fichier redessinait les catégories avec
 * ses propres styles, et embarquait sa copie de `groupItemsByCategory`.
 */
export function ChangelogVersionCard({ version, collapsible = false }: Props) {
    const [expanded, setExpanded] = useState(!collapsible)
    const [editOpen, setEditOpen] = useState(false)

    const { removeVersion, updateStatus } = useChangelogContext()
    const { hasPermission } = useAuth()

    const canEdit = hasPermission(CHANGELOG_PERMISSIONS.edit)
    const canDelete = hasPermission(CHANGELOG_PERMISSIONS.delete)

    const status = STATUS_CONFIG[version.status]
    const groups = useMemo(
        () => groupItemsByCategory(version.items),
        [version.items]
    )

    return (
        <>
            <Card
                className={`relative border border-border bg-card shadow-surface ${
                    version.status === "draft" ? "border-dashed" : ""
                }`}
            >
                <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <CardTitle className="text-lg font-semibold">
                                {version.version}
                            </CardTitle>
                            <Badge variant={status.variant}>
                                <status.icon className="mr-1 size-3" />
                                {status.label}
                            </Badge>
                        </div>

                        {version.deployment_date && (
                            <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                                <Calendar className="size-4 text-primary" />
                                {version.status === "draft"
                                    ? "Prévu le"
                                    : "Déployé le"}{" "}
                                <span className="font-medium">
                                    {format(
                                        new Date(version.deployment_date),
                                        "PPP 'à' HH:mm",
                                        { locale: fr }
                                    )}
                                </span>
                            </p>
                        )}

                        {version.summary && (
                            <p className="mt-1 text-sm text-muted-foreground">
                                {version.summary}
                            </p>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1 sm:shrink-0">
                        {collapsible && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setExpanded((p) => !p)}
                                aria-label={expanded ? "Réduire" : "Développer"}
                                aria-expanded={expanded}
                            >
                                {expanded ? (
                                    <ChevronUp className="size-5" />
                                ) : (
                                    <ChevronDown className="size-5" />
                                )}
                            </Button>
                        )}

                        {version.status === "draft" && canEdit && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    void updateStatus(version.id, "published")
                                }
                            >
                                <Send className="size-3" />
                                Publier
                            </Button>
                        )}

                        {version.status === "published" && canEdit && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    void updateStatus(version.id, "archived")
                                }
                            >
                                <Archive className="size-3" />
                                Archiver
                            </Button>
                        )}

                        {canEdit && (
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => setEditOpen(true)}
                                aria-label={`Modifier le changelog ${version.version}`}
                            >
                                <Pencil className="size-4" />
                            </Button>
                        )}

                        {canDelete && (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button
                                        variant="destructive"
                                        size="icon"
                                        aria-label={`Supprimer le changelog ${version.version}`}
                                    >
                                        <Trash className="size-4" />
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>
                                            Supprimer le changelog{" "}
                                            {version.version} ?
                                        </AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Cette action est irréversible. La
                                            version et ses entrées seront
                                            définitivement supprimées.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>
                                            Annuler
                                        </AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={() =>
                                                void removeVersion(version.id)
                                            }
                                        >
                                            Supprimer
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                    </div>
                </CardHeader>

                {expanded && (
                    <CardContent>
                        <div className="max-h-96 space-y-4 overflow-y-auto pr-2">
                            {groups.length === 0 ? (
                                <p className="text-sm italic text-muted-foreground">
                                    Aucun élément dans ce changelog.
                                </p>
                            ) : (
                                groups.map(({ category, titleGroups }) => (
                                    <CategorySection
                                        key={category.id}
                                        category={category}
                                        titleGroups={titleGroups}
                                        searchTerm=""
                                    />
                                ))
                            )}
                        </div>
                    </CardContent>
                )}
            </Card>

            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className={CHANGELOG_DIALOG_SIZE}>
                    <DialogHeader>
                        <DialogTitle className="mb-2 text-2xl font-bold">
                            Modifier le changelog
                        </DialogTitle>
                    </DialogHeader>
                    <ChangelogForm
                        mode="edit"
                        version={version}
                        setOpen={setEditOpen}
                    />
                </DialogContent>
            </Dialog>
        </>
    )
}
