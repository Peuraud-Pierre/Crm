import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"

interface PaginationFooterProps {
    /** Index de page à partir de 0 — affiché incrémenté. */
    pageIndex: number
    hasPrevious: boolean
    hasNext: boolean
    onPrevious: () => void
    onNext: () => void
    /** Total de pages, quand il est connu (pagination côté client). */
    totalPages?: number
}

/**
 * Pied de pagination Précédent / Suivant.
 *
 * Volontairement pas de pagination numérotée : sur le journal, connaître le
 * nombre de pages imposerait un COUNT exact sur une table de logs — le dépôt
 * s'y est déjà brûlé (timeout 57014 sur `app_logs`, d'où le `count: "planned"`
 * de `appLogsService`). `totalPages` n'est donc renseigné que par les listes
 * paginées côté client.
 *
 * Reprend la convention de `ErrorConsole.tsx` plutôt que
 * `shared/ui/atoms/pagination.tsx`, qui est du shadcn mort (aucun consommateur,
 * et rend une `<a>` sans `href`).
 */
export function PaginationFooter({
    pageIndex,
    hasPrevious,
    hasNext,
    onPrevious,
    onNext,
    totalPages,
}: PaginationFooterProps) {
    if (!hasPrevious && !hasNext) return null

    return (
        <div className="flex items-center justify-between gap-2 border-t border-border p-3 sm:px-6">
            <Button
                variant="outline"
                size="sm"
                onClick={onPrevious}
                disabled={!hasPrevious}
            >
                <ChevronLeft className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Précédent</span>
            </Button>

            <span className="text-xs tabular-nums text-muted-foreground">
                Page {pageIndex + 1}
                {totalPages ? ` sur ${totalPages}` : ""}
            </span>

            <Button
                variant="outline"
                size="sm"
                onClick={onNext}
                disabled={!hasNext}
            >
                <span className="hidden sm:inline">Suivant</span>
                <ChevronRight className="h-4 w-4 sm:ml-1" />
            </Button>
        </div>
    )
}
