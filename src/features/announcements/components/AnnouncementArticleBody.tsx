import { useState } from "react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { ArrowUpRight, Maximize2 } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/atoms/avatar"
import { DialogDescription, DialogTitle } from "@/shared/ui/atoms/dialog"
import {
    ANNOUNCEMENT_TYPE_ACCENT,
    ANNOUNCEMENT_TYPE_LABELS,
} from "../constants"
import { resolveAnnouncementImage } from "../services/announcementService"
import type { Announcement } from "../types/announcement.types"
import { renderMarkdown, safeHref } from "../utils/renderMarkdown"

interface Props {
    announcement: Announcement
    /**
     * Dans un dialogue, le titre et le chapô doivent être les éléments que
     * Radix annonce (`DialogTitle`/`DialogDescription`). Ailleurs — dans
     * l'aperçu de la console d'administration — ce sont de simples
     * éléments de texte : poser un `DialogTitle` hors de son `Dialog`
     * lèverait un avertissement d'accessibilité pour rien.
     */
    inDialog?: boolean
}

/**
 * Le corps d'une annonce, mise en page d'article.
 *
 * Extrait pour que l'aperçu de la console rende **exactement** ce que
 * lira le destinataire. L'aperçu montrait jusque-là `AnnouncementCard`,
 * un troisième gabarit qui n'existe que dans la liste d'administration :
 * l'auteur qui rédigeait du markdown n'en voyait donc jamais le rendu,
 * alors que c'est la seule chose pour laquelle un aperçu existe.
 */
export function AnnouncementArticleBody({ announcement, inDialog }: Props) {
    // Hook inconditionnel : l'agrandissement de l'image se fait sur place,
    // sans seconde modale par-dessus la première.
    const [zoomed, setZoomed] = useState(false)

    const Title = inDialog ? DialogTitle : "h2"
    const Description = inDialog ? DialogDescription : "p"

    const imageUrl = resolveAnnouncementImage(announcement.image)
    const accent = ANNOUNCEMENT_TYPE_ACCENT[announcement.type]
    const displayDate = announcement.event_date ?? announcement.start_date
    const body = announcement.body_markdown?.trim()
    const link = announcement.link ? safeHref(announcement.link) : null

    return (
        <>
            {imageUrl && (
                <button
                    type="button"
                    className="group relative block w-full cursor-zoom-in overflow-hidden"
                    aria-label={
                        zoomed
                            ? "Réduire l'image"
                            : "Afficher l'image en entier"
                    }
                    onClick={() => setZoomed((p) => !p)}
                >
                    <img
                        src={imageUrl}
                        alt={announcement.titre}
                        className={cn(
                            "w-full transition-[aspect-ratio] duration-slow ease-emphasized motion-reduce:transition-none",
                            zoomed
                                ? "aspect-auto object-contain"
                                : "aspect-[21/9] object-cover"
                        )}
                    />
                    <span className="absolute right-3 bottom-3 rounded-full bg-background/80 p-1.5 opacity-0 backdrop-blur-sm transition-opacity duration-fast group-hover:opacity-100">
                        <Maximize2 className="size-4" />
                    </span>
                </button>
            )}

            <article className="flex flex-col gap-5 px-6 py-6 sm:px-10 sm:py-8">
                <header className="flex flex-col gap-3">
                    {/* Le surtitre : rubrique et date. C'est ce qui
                    manquait le plus — sans date, une annonce n'est
                    pas datée, donc ce n'est pas un article. */}
                    <p className="flex flex-wrap items-center gap-2 text-3xs tracking-widest uppercase">
                        <span className={cn("font-semibold", accent.text)}>
                            {ANNOUNCEMENT_TYPE_LABELS[announcement.type] ??
                                announcement.type}
                        </span>
                        <span aria-hidden="true" className="text-border">
                            ·
                        </span>
                        <time
                            dateTime={displayDate}
                            className="text-muted-foreground"
                        >
                            {format(new Date(displayDate), "d MMMM yyyy", {
                                locale: fr,
                            })}
                        </time>
                    </p>

                    <Title className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
                        {announcement.titre}
                    </Title>

                    {announcement.excerpt ? (
                        <Description className="max-w-prose text-lg leading-relaxed text-muted-foreground">
                            {announcement.excerpt}
                        </Description>
                    ) : (
                        <Description className="sr-only">
                            {ANNOUNCEMENT_TYPE_LABELS[announcement.type]} du{" "}
                            {format(new Date(displayDate), "d MMMM yyyy", {
                                locale: fr,
                            })}
                        </Description>
                    )}
                </header>

                <span
                    aria-hidden="true"
                    className={cn("h-0.5 w-12 rounded-full", accent.rule)}
                />

                <div className="max-w-prose space-y-4 text-sm text-foreground/90">
                    {body ? (
                        renderMarkdown(body)
                    ) : announcement.description ? (
                        <p className="whitespace-pre-wrap break-words leading-7">
                            {announcement.description}
                        </p>
                    ) : null}
                </div>

                {(announcement.author || link) && (
                    <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-border/60 pt-5">
                        {announcement.author ? (
                            <Signature author={announcement.author} />
                        ) : (
                            <span />
                        )}

                        {link && (
                            <a
                                href={link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
                            >
                                Ouvrir le lien
                                <ArrowUpRight className="size-4" />
                            </a>
                        )}
                    </footer>
                )}
            </article>
        </>
    )
}

function Signature({
    author,
}: {
    author: NonNullable<Announcement["author"]>
}) {
    const name = author.full_name?.trim() || "Auteur inconnu"

    return (
        <span className="flex items-center gap-2.5">
            <Avatar className="size-8">
                {author.avatar_url && (
                    <AvatarImage src={author.avatar_url} alt="" />
                )}
                <AvatarFallback className="text-xs">
                    {initials(name)}
                </AvatarFallback>
            </Avatar>
            <span className="flex flex-col leading-tight">
                <span className="text-3xs tracking-widest text-muted-foreground uppercase">
                    Publié par
                </span>
                <span className="text-sm font-medium">{name}</span>
            </span>
        </span>
    )
}

function initials(name: string): string {
    return name
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join("")
}
