import type { ReactNode } from "react"
import { Download } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { formatFileSize } from "../../utils/messageFormatting"

export type MessageAttachmentProps = {
    url: string
    name?: string | null
    size?: number | null
    icon?: ReactNode
    /** Bulle envoyée : les tokens de contraste changent de camp. */
    isMine?: boolean
}

/**
 * Ligne de fichier téléchargeable.
 *
 * Portait auparavant `border-white/20 bg-card/10` — un blanc en dur (que la
 * règle ESLint du §12.4 ne couvre pas, elle ne vise que `bg-white`/
 * `text-white`) calibré pour la bulle `bg-primary` et donc presque invisible
 * sur une bulle reçue. Et rien n'indiquait que c'était téléchargeable.
 */
export function MessageAttachment({
    url,
    name,
    size,
    icon,
    isMine,
}: MessageAttachmentProps) {
    const sizeLabel = formatFileSize(size)

    return (
        <a
            href={url}
            download={name ?? undefined}
            className={cn(
                "group/file -mx-1 flex items-center gap-3 rounded-xl px-1.5 py-1 transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isMine
                    ? "hover:bg-primary-foreground/10"
                    : "hover:bg-foreground/5"
            )}
            title={name ? `Télécharger ${name}` : "Télécharger le fichier"}
        >
            {/* Pastille d'icône : idiome StatTile du design system. */}
            <span
                className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-xl ring-1",
                    isMine
                        ? "bg-primary-foreground/15 ring-primary-foreground/20"
                        : "bg-background ring-border"
                )}
                aria-hidden
            >
                {icon}
            </span>

            <span className="flex min-w-0 flex-col">
                <span className="max-w-44 truncate text-sm font-medium">
                    {name ?? "Fichier"}
                </span>
                {sizeLabel ? (
                    <span className="text-2xs opacity-70">{sizeLabel}</span>
                ) : null}
            </span>

            <span
                className={cn(
                    "ml-auto shrink-0 rounded-full p-1.5 opacity-60 transition-opacity duration-fast group-hover/file:opacity-100"
                )}
                aria-hidden
            >
                <Download className="h-4 w-4" />
            </span>
        </a>
    )
}
