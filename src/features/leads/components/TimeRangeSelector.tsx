import { useRef } from "react"
import {
    TabButton,
    TabButtonGroup,
} from "@/shared/ui/molecules/tab-button-group"

export type LeadsTimeRange = "week" | "30days" | "month" | "year"

const RANGES: { id: LeadsTimeRange; label: string }[] = [
    { id: "week", label: "Semaine" },
    { id: "30days", label: "30 Jours" },
    { id: "month", label: "Mois" },
    { id: "year", label: "Année" },
]

interface TimeRangeSelectorProps {
    timeRange: LeadsTimeRange
    onTimeRangeChange: (value: LeadsTimeRange) => void
    selectedDate: string | null
    onResetSelectedDate: () => void
}

export function TimeRangeSelector({
    timeRange,
    onTimeRangeChange,
    selectedDate,
    onResetSelectedDate,
}: TimeRangeSelectorProps) {
    // Conteneur de la bascule : offsetParent de la pastille glissante.
    const rangeRef = useRef<HTMLDivElement | null>(null)

    return (
        <div className="flex items-center gap-2">
            <TabButtonGroup
                containerRef={rangeRef}
                className="flex bg-muted p-1 rounded-lg"
            >
                {RANGES.map(({ id, label }) => (
                    <TabButton
                        key={id}
                        id={id}
                        label={label}
                        shortLabel={label}
                        active={timeRange}
                        set={(v) => onTimeRangeChange(v as LeadsTimeRange)}
                    />
                ))}
            </TabButtonGroup>
            {selectedDate && (
                <div className="flex items-center gap-2 ml-4">
                    <span className="text-sm font-medium">
                        Filtre: {selectedDate}
                    </span>
                    <button
                        onClick={onResetSelectedDate}
                        className="text-sm text-blue-500 hover:underline"
                    >
                        Réinitialiser
                    </button>
                </div>
            )}
        </div>
    )
}
