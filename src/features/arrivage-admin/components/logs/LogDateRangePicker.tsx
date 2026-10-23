import { useState } from "react"
import type { DateRange } from "react-day-picker"
import { CalendarDays, X } from "lucide-react"
import { endOfDay, startOfDay } from "date-fns"
import { fr } from "date-fns/locale"
import { Button } from "@/shared/ui/atoms/button"
import { Calendar } from "@/shared/ui/atoms/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/shared/ui/atoms/popover"
import { formatDate } from "@/features/arrivage-admin/utils/format"

interface LogDateRangePickerProps {
    since: string | null
    until: string | null
    /** Bornes ISO 8601, ou (null, null) pour effacer le filtre. */
    onChange: (since: string | null, until: string | null) => void
}

/**
 * Filtre de plage de dates du journal. Reprend le Calendar `mode="range"` dans
 * un Popover utilisé par `ExportArrivageButton`.
 *
 * Les bornes sont élargies au jour entier (00:00:00 → 23:59:59) : l'admin
 * pense en journées, pas en instants, et un `until` à minuit exclurait toute
 * la journée sélectionnée.
 */
export function LogDateRangePicker({
    since,
    until,
    onChange,
}: LogDateRangePickerProps) {
    const [open, setOpen] = useState(false)

    const range: DateRange | undefined = since
        ? { from: new Date(since), to: until ? new Date(until) : undefined }
        : undefined

    const handleSelect = (next: DateRange | undefined) => {
        if (!next?.from) {
            onChange(null, null)
            return
        }
        onChange(
            startOfDay(next.from).toISOString(),
            next.to ? endOfDay(next.to).toISOString() : null
        )
    }

    const label = since
        ? until
            ? `${formatDate(since)} → ${formatDate(until)}`
            : `Depuis le ${formatDate(since)}`
        : "Toutes dates"

    return (
        <div className="flex items-center gap-1">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        size="sm"
                        className="justify-start font-normal"
                    >
                        <CalendarDays className="mr-2 h-4 w-4 shrink-0" />
                        <span className="truncate">{label}</span>
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                        mode="range"
                        selected={range}
                        onSelect={handleSelect}
                        locale={fr}
                        numberOfMonths={1}
                        className="rounded-md"
                    />
                </PopoverContent>
            </Popover>

            {since && (
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground"
                    onClick={() => onChange(null, null)}
                    aria-label="Effacer le filtre de dates"
                >
                    <X className="h-4 w-4" />
                </Button>
            )}
        </div>
    )
}
