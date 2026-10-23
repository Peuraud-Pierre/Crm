import { useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { endOfMonth, format, startOfMonth } from "date-fns"
import { fr } from "date-fns/locale"
import { CalendarRange, Printer } from "lucide-react"
import type { DateRange } from "react-day-picker"
import { Button } from "@/shared/ui/atoms/button"
import { Calendar } from "@/shared/ui/atoms/calendar"
import {
    Dialog,
    DialogContent_2,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/shared/ui/atoms/dialog"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/shared/ui/atoms/popover"
import type { ArrivageManuelRow } from "@/features/stock/types/arrivage-manuel.types"
import type { ColDef } from "@/features/stock/utils/arrivageExportColumns"
import { filterArrivagesByRange } from "@/features/stock/utils/arrivageGrouping"
import { useIsMobile } from "@/shared/hooks/use-mobile"
import { cn } from "@/shared/lib/utils"
import ArrivagePrintDocument, { type PrintVariant } from "./ArrivagePrintDocument"

interface PrintArrivageDialogProps {
    open:         boolean
    onOpenChange: (open: boolean) => void
    rows:         ArrivageManuelRow[]
    cols:         ColDef[]
}

const VARIANTS: { value: PrintVariant; label: string; description: string }[] = [
    {
        value: "detailed",
        label: "Détaillé",
        description: "Le tableau complet, comme l'export Excel — toutes les colonnes, en paysage.",
    },
    {
        value: "simple",
        label: "Simple",
        description: "Agenda de déchargement condensé, en portrait — pensé pour tenir sur une page.",
    },
]

export default function PrintArrivageDialog({
    open, onOpenChange, rows, cols,
}: PrintArrivageDialogProps) {
    const isMobile = useIsMobile()
    const [variant, setVariant] = useState<PrintVariant>("detailed")
    const [rangeOpen, setRangeOpen] = useState(false)
    const [range, setRange] = useState<DateRange>(() => ({
        from: startOfMonth(new Date()),
        to:   endOfMonth(new Date()),
    }))

    const from = range.from ?? startOfMonth(new Date())
    const to   = range.to ?? from

    const filtered = useMemo(
        () => filterArrivagesByRange(rows, from, to),
        [rows, from, to]
    )

    // Les deux formats s'impriment en paysage. Déclarer `size` verrouille
    // l'orientation et grise le sélecteur paysage/portrait du navigateur : c'est
    // voulu ici, mais c'est aussi la ligne à retirer pour rendre le choix à
    // l'utilisateur (le navigateur repasserait alors en portrait par défaut).
    const pageRule = "@page { size: A4 landscape; margin: 8mm; }"

    // Le portal d'impression est un enfant direct de <body> : print.css masque
    // tout le reste du body, y compris le portal Radix qui porte ce dialog.
    const printRoot = open
        ? createPortal(
              <div className="apd-root" aria-hidden>
                  <style>{pageRule}</style>
                  <ArrivagePrintDocument
                      variant={variant}
                      rows={filtered}
                      cols={cols}
                      from={from}
                      to={to}
                  />
              </div>,
              document.body
          )
        : null

    const handlePrint = () => {
        // Laisse le navigateur peindre le portal avant d'ouvrir la boîte d'impression.
        requestAnimationFrame(() => window.print())
    }

    const rangeLabel = isMobile
        ? `${format(from, "dd/MM/yy")} – ${format(to, "dd/MM/yy")}`
        : `${format(from, "d MMM yyyy", { locale: fr })} – ${format(to, "d MMM yyyy", { locale: fr })}`

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent_2>
                    <DialogHeader>
                        <DialogTitle>Imprimer les arrivages</DialogTitle>
                        <DialogDescription>
                            Choisis un format et une période, puis vérifie l'aperçu avant d'imprimer.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-col gap-4">
                        <div className="grid gap-2 sm:grid-cols-2">
                            {VARIANTS.map(v => (
                                <button
                                    key={v.value}
                                    type="button"
                                    onClick={() => setVariant(v.value)}
                                    aria-pressed={variant === v.value}
                                    className={cn(
                                        "rounded-lg border p-3 text-left transition-colors duration-base",
                                        variant === v.value
                                            ? "border-primary bg-primary/5"
                                            : "border-border hover:bg-muted/50"
                                    )}
                                >
                                    <span className="text-sm font-medium">{v.label}</span>
                                    <span className="mt-0.5 block text-xs text-muted-foreground">
                                        {v.description}
                                    </span>
                                </button>
                            ))}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <Popover open={rangeOpen} onOpenChange={setRangeOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                                        <CalendarRange size={13} aria-hidden />
                                        {rangeLabel}
                                    </Button>
                                </PopoverTrigger>
                                {/* Valeur arbitraire assumée : le calendrier a une largeur
                                    intrinsèque (2 mois côte à côte) qu'aucun token de
                                    largeur ne borne — il faut le viewport moins la marge. */}
                                <PopoverContent className="w-auto max-w-[calc(100vw-2rem)] overflow-x-auto p-0" align="start">
                                    <Calendar
                                        mode="range"
                                        selected={range}
                                        onSelect={r => setRange(r ?? { from: undefined, to: undefined })}
                                        locale={fr}
                                        numberOfMonths={isMobile ? 1 : 2}
                                        className="rounded-md"
                                    />
                                </PopoverContent>
                            </Popover>
                            <span className="text-xs text-muted-foreground">
                                {filtered.length} arrivage{filtered.length > 1 ? "s" : ""} sur cette période
                            </span>
                        </div>

                        <div className="apd-preview rounded-lg border border-border">
                            <ArrivagePrintDocument
                                variant={variant}
                                rows={filtered}
                                cols={cols}
                                from={from}
                                to={to}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                            Annuler
                        </Button>
                        <Button
                            size="sm"
                            className="gap-1.5"
                            disabled={filtered.length === 0}
                            onClick={handlePrint}
                        >
                            <Printer size={14} aria-hidden />
                            Imprimer
                        </Button>
                    </DialogFooter>
                </DialogContent_2>
            </Dialog>

            {printRoot}
        </>
    )
}
