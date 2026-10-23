import { useState } from "react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { CalendarRange, ChevronDown, Download, FileDown } from "lucide-react"
import type { DateRange } from "react-day-picker"
import { Button } from "@/shared/ui/atoms/button"
import { Calendar } from "@/shared/ui/atoms/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/atoms/popover"
import { cn } from "@/shared/lib/utils"
import { useIsMobile } from "@/shared/hooks/use-mobile"

/**
 * Export Excel : tout le tableau, ou une période choisie au calendrier.
 *
 * Ne connaît ni les colonnes, ni les permissions, ni le format de sortie : le
 * module lui passe `onExport`, déjà refermé sur ses colonnes autorisées. Le
 * bouton n'est même pas rendu quand le module n'en a pas le droit — c'est à lui
 * de ne pas l'appeler (DESIGN_SYSTEM.md §14.3).
 *
 * L'export est déclenché dans un `setTimeout(0)` : la génération du classeur est
 * synchrone et bloque le thread principal, ce qui empêcherait l'indicateur de
 * chargement d'apparaître avant la fin du travail.
 */

interface ExportButtonProps<T> {
    rows: readonly T[] | undefined
    /** Exporte les lignes données ; `suffix` s'ajoute au nom de fichier. */
    onExport: (rows: readonly T[], suffix: string) => void
    /**
     * Restreint les lignes à une période. Absent, le bouton d'export par
     * période n'est pas proposé — un module sans date de référence claire ne
     * doit pas laisser croire qu'il sait filtrer.
     */
    filterByRange?: (rows: readonly T[], from: Date, to: Date) => T[]
    /** Précision sur la date utilisée par le filtre, affichée dans le popover. */
    rangeHint?: string
}

export function ExportButton<T>({
    rows,
    onExport,
    filterByRange,
    rangeHint,
}: ExportButtonProps<T>) {
    const isMobile = useIsMobile()
    const [open, setOpen] = useState(false)
    const [range, setRange] = useState<DateRange | undefined>()
    const [exporting, setExporting] = useState<"quick" | "range" | null>(null)

    const empty = !rows?.length

    const handleQuickExport = () => {
        if (!rows?.length) return
        setExporting("quick")
        setTimeout(() => {
            onExport(rows, "")
            setExporting(null)
        }, 0)
    }

    const handleRangeExport = () => {
        if (!rows?.length || !range?.from || !filterByRange) return

        const from = new Date(range.from)
        const to = new Date(range.to ?? range.from)

        setExporting("range")
        setTimeout(() => {
            const fromLabel = format(from, "dd-MM-yyyy")
            const toLabel = format(to, "dd-MM-yyyy")
            const suffix =
                from.toDateString() === to.toDateString()
                    ? `_${fromLabel}`
                    : `_${fromLabel}_${toLabel}`

            onExport(filterByRange(rows, from, to), suffix)
            setExporting(null)
            setOpen(false)
            setRange(undefined)
        }, 0)
    }

    const rangeLabel = range?.from
        ? range.to && range.from.getTime() !== range.to.getTime()
            ? `${format(range.from, "d MMM", { locale: fr })} – ${format(range.to, "d MMM yyyy", { locale: fr })}`
            : format(range.from, "d MMM yyyy", { locale: fr })
        : null

    return (
        <div className="flex items-center gap-1">
            <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={handleQuickExport}
                disabled={empty || exporting !== null}
                loading={exporting === "quick"}
                title="Exporter tout le tableau en Excel"
            >
                {exporting !== "quick" && <FileDown size={13} aria-hidden />}
                Exporter
            </Button>

            {filterByRange && (
                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-auto px-2 gap-1"
                            disabled={empty}
                            title="Export par période"
                            aria-label="Export par période"
                        >
                            <CalendarRange size={13} aria-hidden />
                            <ChevronDown
                                size={10}
                                aria-hidden
                                className={cn(
                                    "transition-transform duration-slow",
                                    open && "rotate-180",
                                )}
                            />
                        </Button>
                    </PopoverTrigger>

                    <PopoverContent className="w-auto p-0" align="end">
                        <div className="flex flex-col gap-0">
                            <div className="px-3 pt-3 pb-1">
                                <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                    Export par période
                                </p>
                                {rangeHint && (
                                    <p className="text-2xs text-muted-foreground mt-0.5">
                                        {rangeHint}
                                    </p>
                                )}
                            </div>

                            <Calendar
                                mode="range"
                                selected={range}
                                onSelect={setRange}
                                locale={fr}
                                // Deux mois font ~560 px : hors écran sur mobile.
                                numberOfMonths={isMobile ? 1 : 2}
                                className="rounded-md"
                            />

                            <div className="flex items-center justify-between px-3 pb-3 pt-1 gap-2 border-t border-slate-100 dark:border-slate-800">
                                <span className="text-2xs text-muted-foreground truncate">
                                    {rangeLabel ?? "Sélectionne une plage"}
                                </span>
                                <Button
                                    size="sm"
                                    className="h-7 gap-1.5 text-xs shrink-0"
                                    disabled={!range?.from || exporting !== null}
                                    loading={exporting === "range"}
                                    onClick={handleRangeExport}
                                >
                                    {exporting !== "range" && <Download size={12} aria-hidden />}
                                    Télécharger
                                </Button>
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>
            )}
        </div>
    )
}
