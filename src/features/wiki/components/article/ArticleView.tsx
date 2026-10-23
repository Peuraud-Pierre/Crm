import { useEffect, useRef, useState } from "react"
import { ArrowLeft, BookOpen, Clock, Eye, Hash, Pencil } from "lucide-react"
import { Badge } from "@/shared/ui/atoms/badge"
import { Button } from "@/shared/ui/atoms/button"
import { cn } from "@/shared/lib/utils"
import {
    WIKI_STATUS_LABEL,
    WIKI_VIEWS_RETENTION_MONTHS,
} from "../../constants"
import { WIKI_THEME } from "../../theme"
import { ArticleSections } from "../shared/ArticleSections"
import { useWikiContext } from "../../hooks/context/useWikiContext"
import { useWikiViewTracker } from "../../hooks/data/useWikiViewTracker"
import type { WikiArticle } from "../../types/wiki-article.types"

/** Entrées du sommaire : sections texte possédant un titre. */
function tocItems(article: WikiArticle): { id: string; title: string }[] {
    return article.sections
        .filter(
            (s): s is Extract<WikiArticle["sections"][number], { type: "text" }> =>
                s.type === "text" && Boolean(s.title?.trim())
        )
        .map((s) => ({ id: s.id, title: s.title as string }))
}

/** Temps de lecture estimé (~200 mots/min) à partir du texte des sections. */
function readingMinutes(article: WikiArticle): number {
    const text = article.sections
        .map((s) =>
            s.type === "text" ? `${s.title ?? ""} ${s.content}` : (s.caption ?? "")
        )
        .join(" ")
        .concat(" ", article.body)
    const words = text.trim().split(/\s+/).filter(Boolean).length
    return Math.max(1, Math.round(words / 200))
}

/**
 * Lecture d'un article. Seule la colonne de contenu défile : l'arbre des
 * catégories (parent) et le sommaire « # » restent fixes, pour permettre de
 * naviguer à tout moment.
 */
export function ArticleView() {
    const {
        selectedArticle,
        setSelectedArticle,
        selectionSource,
        canManage,
        openEditArticle,
    } = useWikiContext()
    const scrollRef = useRef<HTMLDivElement>(null)
    const [activeId, setActiveId] = useState<string | null>(null)

    // Télémétrie de lecture : une ligne par ouverture, complétée à la sortie
    // (temps passé, bas de page atteint). Placée ici car c'est le point
    // d'affichage unique d'un article, et le conteneur défilant est déjà là.
    useWikiViewTracker(selectedArticle?.id ?? null, selectionSource, scrollRef)

    // Scroll-spy : surligne l'entrée correspondant à la section la plus haute
    // visible, en observant l'intérieur de la colonne défilante.
    useEffect(() => {
        if (!selectedArticle) return
        const root = scrollRef.current
        const items = tocItems(selectedArticle)
        if (!root || items.length < 2) return

        const headings = items
            .map((t) => root.querySelector<HTMLElement>(`#wiki-sec-${t.id}`))
            .filter((el): el is HTMLElement => el !== null)
        if (headings.length === 0) return

        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries
                    .filter((e) => e.isIntersecting)
                    .sort(
                        (a, b) =>
                            a.boundingClientRect.top - b.boundingClientRect.top
                    )
                if (visible[0]) {
                    setActiveId(visible[0].target.id.replace("wiki-sec-", ""))
                }
            },
            { root, rootMargin: "0px 0px -72% 0px", threshold: 0 }
        )
        headings.forEach((h) => observer.observe(h))
        return () => observer.disconnect()
    }, [selectedArticle])

    if (!selectedArticle) return null

    const isDraft = selectedArticle.status === "draft"
    const updated = new Date(selectedArticle.updated_at).toLocaleDateString(
        "fr-FR",
        { day: "numeric", month: "long", year: "numeric" }
    )
    const minutes = readingMinutes(selectedArticle)
    const toc = tocItems(selectedArticle)

    const goToSection = (id: string) => {
        const reduceMotion = window.matchMedia(
            "(prefers-reduced-motion: reduce)"
        ).matches
        scrollRef.current
            ?.querySelector(`#wiki-sec-${id}`)
            ?.scrollIntoView({
                behavior: reduceMotion ? "auto" : "smooth",
                block: "start",
            })
    }

    return (
        <div className="flex min-h-0 w-full flex-1">
            {/* Colonne article : SEULE à défiler */}
            <div
                ref={scrollRef}
                tabIndex={0}
                role="region"
                aria-label="Contenu de l'article"
                className="min-w-0 flex-1 overflow-y-auto focus-visible:outline-none"
            >
                <div className="mx-auto max-w-3xl animate-in fade-in slide-in-from-bottom-1 px-5 py-8 duration-slow md:px-8 md:py-10">
                    {/* Barre d'actions discrète */}
                    <div className="mb-6 flex items-center justify-between gap-3">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="-ml-2 gap-1.5 text-muted-foreground hover:text-foreground"
                            onClick={() => setSelectedArticle(null)}
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Tous les articles
                        </Button>
                        {canManage && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                onClick={() => openEditArticle(selectedArticle)}
                            >
                                <Pencil className="h-4 w-4" />
                                Modifier
                            </Button>
                        )}
                    </div>

                    <article>
                        <header className="mb-8">
                            <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
                                <h1 className="text-3xl font-bold leading-[1.12] tracking-tight text-foreground md:text-[2.6rem]">
                                    {selectedArticle.title}
                                </h1>
                                {canManage && isDraft && (
                                    <Badge
                                        variant="outline"
                                        className={cn(
                                            "mt-1.5 shrink-0",
                                            WIKI_THEME.badge.draft
                                        )}
                                    >
                                        {WIKI_STATUS_LABEL.draft}
                                    </Badge>
                                )}
                            </div>

                            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1.5">
                                    <Clock className="h-3.5 w-3.5" />
                                    Mis à jour le {updated}
                                </span>
                                <span
                                    aria-hidden
                                    className="h-1 w-1 rounded-full bg-border"
                                />
                                <span className="flex items-center gap-1.5">
                                    <BookOpen className="h-3.5 w-3.5" />
                                    {minutes} min de lecture
                                </span>
                                <span
                                    aria-hidden
                                    className="h-1 w-1 rounded-full bg-border"
                                />
                                {/* Information des lecteurs : la consultation
                                    est nominative, les personnes tracées
                                    doivent le savoir depuis l'écran où le
                                    traçage a lieu. */}
                                <span
                                    className="flex cursor-help items-center gap-1.5"
                                    title={`Les ouvertures d'articles sont enregistrées (qui, quand, durée) pour mesurer l'utilité du wiki. Ces données sont visibles des gestionnaires du wiki et conservées ${WIKI_VIEWS_RETENTION_MONTHS} mois.`}
                                >
                                    <Eye className="h-3.5 w-3.5" />
                                    Consultation enregistrée
                                </span>
                            </div>

                            {/* Filet d'accent */}
                            <div className="mt-6 h-px bg-gradient-to-r from-primary/50 via-border to-transparent" />
                        </header>

                        <ArticleSections article={selectedArticle} />
                    </article>
                </div>
            </div>

            {/* Sommaire fixe (≥ 2 sections titrées, écrans larges) */}
            {toc.length >= 2 && (
                <aside className="hidden w-60 shrink-0 overflow-y-auto border-l lg:block">
                    <div className="p-5">
                        <p className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            <Hash className="h-3.5 w-3.5" />
                            Sur cette page
                        </p>
                        <nav aria-label="Sommaire de l'article" className="border-l">
                            {toc.map((item) => {
                                const active = activeId === item.id
                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        aria-current={active ? "true" : undefined}
                                        onClick={() => goToSection(item.id)}
                                        className={cn(
                                            "-ml-px block w-full truncate border-l-2 py-1 pl-3 text-left text-xs transition-colors focus-visible:outline-none focus-visible:text-foreground",
                                            active
                                                ? "border-primary font-medium text-primary"
                                                : "border-transparent text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                                        )}
                                    >
                                        {item.title}
                                    </button>
                                )
                            })}
                        </nav>
                    </div>
                </aside>
            )}
        </div>
    )
}
