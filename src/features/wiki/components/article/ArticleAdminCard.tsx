import {
    Clock,
    Eye,
    EyeOff,
    FileText,
    FolderOpen,
    Image as ImageIcon,
    Pencil,
    Trash2,
} from "lucide-react"
import { Badge } from "@/shared/ui/atoms/badge"
import { Button } from "@/shared/ui/atoms/button"
import { cn } from "@/shared/lib/utils"
import { WIKI_STATUS_LABEL } from "../../constants"
import { WIKI_THEME } from "../../theme"
import type { WikiArticle } from "../../types/wiki-article.types"

interface ArticleAdminCardProps {
    article: WikiArticle
    /** Libellé du chemin de catégorie (ou « Sans catégorie »). */
    categoryPath: string
    deleting: boolean
    toggling: boolean
    onEdit: () => void
    onDelete: () => void
    onTogglePublish: () => void
}

/** Carte de gestion d'un article : statut, méta, actions rapides. */
export function ArticleAdminCard({
    article,
    categoryPath,
    deleting,
    toggling,
    onEdit,
    onDelete,
    onTogglePublish,
}: ArticleAdminCardProps) {
    const isPublished = article.status === "published"
    const sectionCount = article.sections.length
    const imageCount = article.sections.filter(
        (s) => s.type === "image"
    ).length
    const updated = new Date(article.updated_at).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    })

    return (
        <div className="group relative flex flex-col gap-3 rounded-xl border bg-card p-4 transition-[transform,box-shadow,border-color] hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm">
            <div className="flex items-center justify-between gap-2">
                <Badge
                    variant="outline"
                    className={cn(
                        "gap-1.5",
                        isPublished
                            ? WIKI_THEME.badge.published
                            : WIKI_THEME.badge.draft
                    )}
                >
                    <span
                        className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            isPublished ? "bg-emerald-500" : "bg-amber-500"
                        )}
                    />
                    {WIKI_STATUS_LABEL[article.status]}
                </Badge>
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {updated}
                </span>
            </div>

            <button
                type="button"
                onClick={onEdit}
                aria-label={`Modifier « ${article.title} »`}
                className="rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0"
            >
                <h3 className="line-clamp-2 font-semibold leading-snug tracking-tight transition-colors group-hover:text-primary">
                    {article.title}
                </h3>
            </button>

            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <FolderOpen className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{categoryPath}</span>
            </p>

            <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3">
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                        <FileText className="h-3.5 w-3.5" />
                        {sectionCount} section{sectionCount > 1 ? "s" : ""}
                    </span>
                    {imageCount > 0 && (
                        <span className="flex items-center gap-1">
                            <ImageIcon className="h-3.5 w-3.5" />
                            {imageCount}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-0.5">
                    <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        loading={toggling}
                        onClick={onTogglePublish}
                        title={isPublished ? "Dépublier" : "Publier"}
                        aria-label={isPublished ? "Dépublier" : "Publier"}
                    >
                        {!toggling &&
                            (isPublished ? (
                                <EyeOff className="h-4 w-4" />
                            ) : (
                                <Eye className="h-4 w-4" />
                            ))}
                    </Button>
                    <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={onEdit}
                        title="Modifier"
                        aria-label="Modifier"
                    >
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        loading={deleting}
                        onClick={onDelete}
                        title="Supprimer"
                        aria-label="Supprimer"
                    >
                        {!deleting && <Trash2 className="h-4 w-4" />}
                    </Button>
                </div>
            </div>
        </div>
    )
}
