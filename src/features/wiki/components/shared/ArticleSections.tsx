import { useState } from "react"
import { ZoomIn } from "lucide-react"
import { Dialog, DialogContent, DialogTitle } from "@/shared/ui/atoms/dialog"
import { MarkdownContent } from "./MarkdownContent"
import type {
    WikiArticle,
    WikiImageSection,
    WikiSection,
} from "../../types/wiki-article.types"

/**
 * Rendu d'une page wiki construite par sections (texte / image).
 * Fallback sur le markdown legacy `body` si aucune section.
 */
export function ArticleSections({ article }: { article: WikiArticle }) {
    if (article.sections.length === 0) {
        return article.body ? (
            <MarkdownContent content={article.body} />
        ) : (
            <p className="text-sm text-muted-foreground">
                Cet article est vide.
            </p>
        )
    }

    return (
        <div className="space-y-6">
            {article.sections.map((section) => (
                <SectionBlock key={section.id} section={section} />
            ))}
        </div>
    )
}

function SectionBlock({ section }: { section: WikiSection }) {
    if (section.type === "image") {
        return <ImageBlock section={section} />
    }

    return (
        <section>
            {section.title && (
                <h2
                    id={`wiki-sec-${section.id}`}
                    className="text-xl font-semibold tracking-tight mb-2 scroll-mt-6"
                >
                    {section.title}
                </h2>
            )}
            <MarkdownContent content={section.content} />
        </section>
    )
}

/** Image cliquable : aperçu + ouverture plein écran (lightbox) pour la lisibilité. */
function ImageBlock({ section }: { section: WikiImageSection }) {
    const [open, setOpen] = useState(false)

    if (!section.url) return null

    const label = section.alt || section.caption || ""

    return (
        <figure className="space-y-2">
            <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label={label ? `Agrandir : ${label}` : "Agrandir l'image"}
                className="group relative block w-full cursor-zoom-in overflow-hidden rounded-xl border bg-muted/30 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0"
            >
                <img
                    src={section.url}
                    alt={label}
                    className="w-full transition-transform duration-slow group-hover:scale-[1.02]"
                    loading="lazy"
                />
                <span className="pointer-events-none absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-background/80 px-2 py-1 text-xs font-medium opacity-0 shadow-sm backdrop-blur transition-opacity group-hover:opacity-100">
                    <ZoomIn className="h-3.5 w-3.5" />
                    Agrandir
                </span>
            </button>

            {section.caption && (
                <figcaption className="text-center text-xs text-muted-foreground">
                    {section.caption}
                </figcaption>
            )}

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent
                    className="max-w-5xl border-0 bg-transparent p-0 shadow-none"
                    aria-describedby={undefined}
                >
                    <DialogTitle className="sr-only">
                        {label || "Image de l'article"}
                    </DialogTitle>
                    <img
                        src={section.url}
                        alt={label}
                        className="max-h-[85vh] w-full rounded-lg object-contain"
                    />
                    {section.caption && (
                        <p className="mt-2 text-center text-sm text-foreground/80">
                            {section.caption}
                        </p>
                    )}
                </DialogContent>
            </Dialog>
        </figure>
    )
}
