"use client"

import { Archive, ArchiveRestore, Pencil, Pin, Trash } from "lucide-react"
import { Badge } from "@/shared/ui/atoms/badge"
import { Button } from "@/shared/ui/atoms/button"
import { Card, CardContent } from "@/shared/ui/atoms/card"
import { cn } from "@/shared/lib/utils"
import { ANNOUNCEMENT_TYPE_LABELS } from "../constants"
import { resolveAnnouncementImage } from "../services/announcementService"
import type { Announcement } from "../types/announcement.types"

interface Props {
    announcement: Announcement
    onClick?: () => void
    onEdit?: (announcement: Announcement) => void
    onDelete?: (announcement: Announcement) => void
    /** Bascule l'archivage — `archived` est l'état cible. */
    onArchive?: (announcement: Announcement, archived: boolean) => void
}

export function AnnouncementCard({
    announcement,
    onClick,
    onEdit,
    onDelete,
    onArchive,
}: Props) {
    const isArchived = Boolean(announcement.archived_at)
    const imageUrl = resolveAnnouncementImage(announcement.image)
    const hasActions = !!(onEdit || onArchive || onDelete)

    return (
        <Card
            variant="interactive"
            className={cn(
                "relative flex flex-col rounded-xl border-primary/30 bg-background shadow-surface",
                isArchived &&
                    "border-dashed border-muted-foreground/40 opacity-70"
            )}
            onClick={onClick}
        >
            <div className="flex aspect-[5/2] w-full items-center justify-center overflow-hidden rounded-t-xl bg-muted">
                {imageUrl ? (
                    <img
                        src={imageUrl}
                        alt={announcement.titre}
                        loading="lazy"
                        className="size-full object-cover transition-[transform,opacity] duration-slow hover:scale-103 hover:opacity-90 motion-reduce:transition-none"
                    />
                ) : (
                    <span className="text-xs uppercase tracking-wide text-muted-foreground opacity-60">
                        Aucune image
                    </span>
                )}
            </div>

            {hasActions && (
                <div className="absolute right-2 top-2 z-10 flex gap-2">
                    {onEdit && (
                        <Button
                            size="icon"
                            variant="secondary"
                            className="size-7 rounded-full"
                            aria-label={`Modifier l'annonce ${announcement.titre}`}
                            onClick={(e) => {
                                e.stopPropagation()
                                onEdit(announcement)
                            }}
                        >
                            <Pencil className="size-4" />
                        </Button>
                    )}
                    {onArchive && (
                        <Button
                            size="icon"
                            variant="secondary"
                            className="size-7 rounded-full"
                            aria-label={
                                isArchived
                                    ? `Désarchiver l'annonce ${announcement.titre}`
                                    : `Archiver l'annonce ${announcement.titre}`
                            }
                            onClick={(e) => {
                                e.stopPropagation()
                                onArchive(announcement, !isArchived)
                            }}
                        >
                            {isArchived ? (
                                <ArchiveRestore className="size-4" />
                            ) : (
                                <Archive className="size-4" />
                            )}
                        </Button>
                    )}
                    {onDelete && (
                        <Button
                            size="icon"
                            variant="destructive"
                            className="size-7 rounded-full"
                            aria-label={`Supprimer l'annonce ${announcement.titre}`}
                            onClick={(e) => {
                                e.stopPropagation()
                                onDelete(announcement)
                            }}
                        >
                            <Trash className="size-4" />
                        </Button>
                    )}
                </div>
            )}

            <CardContent className="flex flex-1 flex-col justify-between p-4">
                <div className="mb-1 flex items-center justify-between gap-2">
                    <h3 className="min-w-0 truncate font-semibold text-foreground">
                        {announcement.titre}
                    </h3>
                    <div className="flex shrink-0 items-center gap-2">
                        {announcement.pinned && (
                            <Pin
                                className="size-4 text-primary"
                                aria-label="Épinglée"
                            />
                        )}
                        {isArchived && (
                            <Badge variant="secondary">Archivée</Badge>
                        )}
                        <Badge variant="outline">
                            {ANNOUNCEMENT_TYPE_LABELS[announcement.type] ??
                                announcement.type}
                        </Badge>
                    </div>
                </div>

                <p className="line-clamp-1 text-sm text-muted-foreground">
                    {announcement.description}
                </p>
            </CardContent>
        </Card>
    )
}
