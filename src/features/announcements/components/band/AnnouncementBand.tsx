import { useMemo, useState } from "react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { ChevronDown, ChevronUp, Megaphone, Pin } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { Button } from "@/shared/ui/atoms/button"
import { Skeleton } from "@/shared/ui/atoms/skeleton"
import { SkeletonGroup } from "@/shared/ui/molecules/skeleton-presets"
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/shared/ui/atoms/tooltip"
import {
    ANNOUNCEMENT_TYPE_ACCENT,
    ANNOUNCEMENT_TYPE_LABELS,
} from "../../constants"
import { useAnnouncements } from "../../hooks/data/useAnnouncements"
import { resolveAnnouncementImage } from "../../services/announcementService"
import type { Announcement } from "../../types/announcement.types"
import {
    compareForDisplay,
    getAnnouncementStatus,
} from "../../utils/announcementStatus"
import { AnnouncementArticle } from "../AnnouncementArticle"

interface Props {
    expanded: boolean
    onExpandedChange: (expanded: boolean) => void
}

/**
 * La manchette : ce qui fait la une du journal interne.
 *
 * Ce n'est pas un module posable, c'est une zone fixe — donc elle ne
 * ressemble pas à une carte. Pas d'arrondi, pas d'ombre, une bordure
 * basse : elle appartient à la page, pas au canevas.
 *
 * Elle porte trois choses qui manquaient et qui font la différence entre
 * une notification et un article : la **rubrique**, colorée ; la **date**,
 * écrite ; et le **chapô**, distinct du corps. Le titre s'affiche sur
 * deux lignes plutôt que tronqué — un titre coupé au milieu n'est pas lu.
 *
 * La rotation automatique de l'ancien carrousel a disparu. Sur une page
 * traversée dix fois par jour, un bandeau qui bouge tout seul attire
 * l'œil sans jamais être lu en entier : la une reste affichée, les autres
 * sont accessibles d'un clic.
 *
 * Quand il n'y a rien à annoncer, la bande n'existe pas. Un bloc « aucune
 * annonce » en permanence en haut de l'accueil occuperait la meilleure
 * place de la page pour ne rien dire.
 */
export function AnnouncementBand({ expanded, onExpandedChange }: Props) {
    const { announcements, loading } = useAnnouncements()
    const [selected, setSelected] = useState<Announcement | null>(null)

    const online = useMemo(() => {
        // `now` est figé pour la durée du calcul : le recalculer à chaque
        // rendu empêcherait toute mémoïsation.
        const now = Date.now()
        return announcements
            .filter((a) => getAnnouncementStatus(a, now) === "online")
            .sort(compareForDisplay)
    }, [announcements])

    if (loading) {
        return (
            <SkeletonGroup
                label="Chargement des annonces"
                className="sticky top-0 z-10 flex h-16 items-center gap-3 border-b bg-card px-4 sm:px-6"
            >
                <Skeleton className="size-4 rounded-full" />
                <Skeleton className="h-4 w-48" />
            </SkeletonGroup>
        )
    }

    if (online.length === 0) return null

    const [lead, ...rest] = online
    // Une annonce épinglée a été mise en avant délibérément : elle ne se
    // replie pas. Un socle d'information qu'on peut masquer pour de bon
    // n'est plus un socle.
    const pinned = online.some((a) => a.pinned)
    const open = expanded || pinned
    const accent = ANNOUNCEMENT_TYPE_ACCENT[lead.type]

    return (
        <section
            aria-label="Annonces"
            className={cn(
                "sticky top-0 z-10 border-b bg-card px-4 sm:px-6",
                // Le seul fond coloré de la page, et il est justifié :
                // c'est le bloc éditorial. Un lavis à 5 %, qui teinte
                // sans jamais concurrencer le texte.
                open && "bg-gradient-to-r to-transparent",
                open && accent.wash
            )}
        >
            {open ? (
                <div className="flex items-stretch gap-3 py-3">
                    <span
                        aria-hidden="true"
                        className={cn("w-1 shrink-0 rounded-full", accent.rule)}
                    />

                    <button
                        type="button"
                        onClick={() => setSelected(lead)}
                        className="flex min-w-0 flex-1 items-center gap-4 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2 text-3xs tracking-widest uppercase">
                                <span
                                    className={cn("font-semibold", accent.text)}
                                >
                                    {ANNOUNCEMENT_TYPE_LABELS[lead.type] ??
                                        lead.type}
                                </span>
                                <span aria-hidden="true" className="text-border">
                                    ·
                                </span>
                                <LeadDate announcement={lead} />
                                {lead.pinned && (
                                    <Pin
                                        className="size-3 text-muted-foreground"
                                        aria-label="Épinglée"
                                    />
                                )}
                            </span>

                            <span className="mt-1 line-clamp-2 block text-base font-semibold text-balance">
                                {lead.titre}
                            </span>

                            {(lead.excerpt || lead.description) && (
                                <span className="mt-0.5 line-clamp-1 block text-sm text-muted-foreground">
                                    {lead.excerpt ?? lead.description}
                                </span>
                            )}
                        </span>

                        <LeadImage announcement={lead} />
                    </button>

                    <CollapseControl
                        open
                        locked={pinned}
                        onToggle={() => onExpandedChange(false)}
                    />
                </div>
            ) : (
                <div className="flex items-center gap-3 py-2.5">
                    <Megaphone className="size-4 shrink-0 text-muted-foreground" />
                    <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                        {online.length === 1
                            ? "1 annonce en cours"
                            : `${online.length} annonces en cours`}
                    </p>
                    <CollapseControl
                        open={false}
                        locked={false}
                        onToggle={() => onExpandedChange(true)}
                    />
                </div>
            )}

            {open && rest.length > 0 && (
                // Défilement horizontal et non `flex-wrap` : la bande est
                // `sticky`, donc chaque passage à la ligne lui prend
                // définitivement une part de l'écran. Avec huit annonces en
                // ligne sur mobile, la une finissait sous le pli.
                <div className="flex gap-2 overflow-x-auto pb-3">
                    {rest.map((a) => (
                        <button
                            key={a.id}
                            type="button"
                            onClick={() => setSelected(a)}
                            className="flex max-w-64 shrink-0 items-center gap-2 rounded-full border border-border/60 bg-card px-3 py-1 text-xs text-muted-foreground transition-colors duration-fast hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <span
                                aria-hidden="true"
                                className={cn(
                                    "size-1.5 shrink-0 rounded-full",
                                    ANNOUNCEMENT_TYPE_ACCENT[a.type].rule
                                )}
                            />
                            <span className="truncate">{a.titre}</span>
                        </button>
                    ))}
                </div>
            )}

            <AnnouncementArticle
                open={!!selected}
                onOpenChange={(next) => !next && setSelected(null)}
                announcement={selected}
            />
        </section>
    )
}

function LeadDate({ announcement }: { announcement: Announcement }) {
    const value = announcement.event_date ?? announcement.start_date

    return (
        <time dateTime={value} className="text-muted-foreground">
            {format(new Date(value), "d MMMM", { locale: fr })}
        </time>
    )
}

function LeadImage({ announcement }: { announcement: Announcement }) {
    const imageUrl = resolveAnnouncementImage(announcement.image)
    if (!imageUrl) return null

    return (
        <img
            src={imageUrl}
            alt=""
            loading="lazy"
            className="hidden h-12 w-20 shrink-0 rounded-md object-cover sm:block"
        />
    )
}

interface CollapseProps {
    open: boolean
    /** Verrouillé déplié par une annonce épinglée. */
    locked: boolean
    onToggle: () => void
}

function CollapseControl({ open, locked, onToggle }: CollapseProps) {
    const button = (
        <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0 self-start"
            disabled={locked}
            onClick={onToggle}
            aria-label={open ? "Replier les annonces" : "Déplier les annonces"}
        >
            {open ? (
                <ChevronUp className="size-4" />
            ) : (
                <ChevronDown className="size-4" />
            )}
        </Button>
    )

    if (!locked) return button

    return (
        <Tooltip>
            {/* Un bouton désactivé n'émet pas d'évènement de survol : c'est
                le span qui porte l'infobulle. */}
            <TooltipTrigger asChild>
                <span tabIndex={0} className="self-start">
                    {button}
                </span>
            </TooltipTrigger>
            <TooltipContent>
                Une annonce épinglée reste dépliée.
            </TooltipContent>
        </Tooltip>
    )
}
