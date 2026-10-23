import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { cn } from "@/shared/lib/utils"

/**
 * Pagination numérotée d'un tableau, en base 0.
 *
 * Fenêtre glissante `page ± 1` bornée par la première et la dernière page. Ce
 * n'est PAS la fenêtre de la pagination de l'historique (`[1..5]` tant qu'on est
 * au début) : les deux coexistent volontairement, les unifier changerait le
 * rendu de l'une d'elles.
 *
 * `flagged` marque une page d'une pastille — les deux tableaux de stock s'en
 * servent pour signaler les pages contenant une échéance proche, qu'on ne
 * verrait pas autrement sans feuilleter.
 */

interface TablePaginationProps {
    /** Page courante, en base 0 ; l'affichage est en base 1. */
    page: number
    totalPages: number
    flagged?: (page: number) => boolean
    onChange: (page: number) => void
}

export function TablePagination({
    page,
    totalPages,
    flagged,
    onChange,
}: TablePaginationProps) {
    if (totalPages <= 1) return null

    const pages: (number | "…")[] = []
    if (totalPages <= 7) {
        for (let i = 0; i < totalPages; i++) pages.push(i)
    } else {
        pages.push(0)
        if (page > 2) pages.push("…")
        for (let i = Math.max(1, page - 1); i <= Math.min(totalPages - 2, page + 1); i++) {
            pages.push(i)
        }
        if (page < totalPages - 3) pages.push("…")
        pages.push(totalPages - 1)
    }

    return (
        <div className="flex items-center justify-between px-1 pt-2">
            <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 gap-1 text-xs text-muted-foreground"
                disabled={page === 0}
                onClick={() => onChange(page - 1)}
                aria-label="Page précédente"
            >
                <ChevronLeft size={13} aria-hidden />
                Précédent
            </Button>

            <div className="flex items-center gap-1" role="navigation" aria-label="Pagination">
                {pages.map((p, i, arr) =>
                    p === "…" ? (
                        <span
                            key={i < arr.length / 2 ? "ellipsis-start" : "ellipsis-end"}
                            className="px-1 text-xs text-muted-foreground select-none"
                            aria-hidden
                        >
                            …
                        </span>
                    ) : (
                        <button
                            key={p}
                            onClick={() => onChange(p)}
                            aria-label={`Page ${p + 1}`}
                            aria-current={p === page ? "page" : undefined}
                            className={cn(
                                "relative h-7 min-w-7 rounded-md px-2 text-xs transition-colors",
                                "outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-1",
                                p === page
                                    ? "bg-primary text-primary-foreground font-medium"
                                    : "text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800",
                            )}
                        >
                            {p + 1}
                            {flagged?.(p) && (
                                <span
                                    className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-amber-400 dark:bg-amber-500 animate-pulse"
                                    aria-hidden
                                />
                            )}
                        </button>
                    ),
                )}
            </div>

            <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 gap-1 text-xs text-muted-foreground"
                disabled={page === totalPages - 1}
                onClick={() => onChange(page + 1)}
                aria-label="Page suivante"
            >
                Suivant
                <ChevronRight size={13} aria-hidden />
            </Button>
        </div>
    )
}
