import { CalendarDays } from "lucide-react"
import { format, parseISO, isValid } from "date-fns"
import { cn } from "@/shared/lib/utils"
import type { Event_creation } from "@/features/crm/hooks/CRM_hook/use_calendar"
import type { CreateEventLogic } from "@/features/crm/types/calendar"

interface EventGridPanelProps {
    logic: CreateEventLogic
    safeDate: (val: unknown) => Date | null
    START_HOUR: number
    END_HOUR: number
    HOUR_HEIGHT: number
    TIME_GRID_ARRAY: number[]
}

export function EventGridPanel({
    logic,
    safeDate,
    START_HOUR,
    END_HOUR,
    HOUR_HEIGHT,
    TIME_GRID_ARRAY,
}: EventGridPanelProps) {
    return (
        <div className="w-full lg:w-[400px] flex-1 lg:flex-none min-h-0 bg-muted flex flex-col border-t lg:border-t-0 lg:border-l border-border relative">
            <div className="p-4 border-b bg-card/50 backdrop-blur-md sticky top-0 z-30 flex justify-between items-center">
                <h3 className="text-sm font-bold flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-primary" />
                    {isValid(parseISO(logic.formData.dateOnly))
                        ? format(
                              parseISO(logic.formData.dateOnly),
                              "dd MMMM yyyy"
                          )
                        : "Date sélectionnée"}
                </h3>
            </div>
            <div
                className="flex-1 overflow-y-auto relative p-4 custom-scrollbar"
                ref={logic.gridRef}
            >
                <div
                    className="relative"
                    style={{
                        height: `${(END_HOUR - START_HOUR + 1) * HOUR_HEIGHT}px`,
                    }}
                >
                    {TIME_GRID_ARRAY.map((hour) => (
                        <div
                            key={hour}
                            className="absolute w-full border-t border-border/50"
                            style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }}
                        >
                            <span className="text-[10px] font-bold text-muted-foreground -translate-y-2 absolute -left-2 w-10 text-right">
                                {hour}:00
                            </span>
                        </div>
                    ))}
                    {logic.daySchedule.map((evt: Event_creation) => {
                        const start = safeDate(evt.debut) || new Date()
                        const end = safeDate(evt.fin) || new Date()
                        const top =
                            (start.getHours() - START_HOUR) * HOUR_HEIGHT +
                            start.getMinutes() * (HOUR_HEIGHT / 60)
                        const height =
                            ((end.getTime() - start.getTime()) / 60000) *
                            (HOUR_HEIGHT / 60)
                        return (
                            <div
                                key={evt.id}
                                className="absolute left-10 right-2 rounded-lg p-2 border-l-4 border-border bg-muted/80 backdrop-blur-sm z-10 text-[10px]"
                                style={{
                                    top: `${top}px`,
                                    height: `${height}px`,
                                }}
                            >
                                <div className="font-bold truncate">
                                    {evt.participants || "Occupé"}
                                </div>
                                <div className="opacity-70">
                                    {format(start, "HH:mm")} -{" "}
                                    {format(end, "HH:mm")}
                                </div>
                            </div>
                        )
                    })}
                    {/* BLOCK DRAGGABLE */}
                    <div
                        onMouseDown={(e) => logic.handleMouseDown(e, "drag")}
                        onTouchStart={(e) => logic.handleMouseDown(e, "drag")}
                        className={cn(
                            // touch-pan-y : le défilement de la grille reste
                            // prioritaire tant que l'appui long n'a pas engagé
                            // le déplacement du créneau.
                            "absolute left-10 right-2 touch-pan-y rounded-xl border-2 z-20 cursor-move shadow-lg transition-colors",
                            logic.isBusy
                                ? "bg-warning border-warning/30"
                                : `${logic.currentTypeConfig.color} border-white`
                        )}
                        style={logic.previewStyles}
                    >
                        {/* eslint-disable-next-line nokk-project/no-restricted-syntax -- texte/média posé sur un aplat de couleur dynamique (donnée ou visuel) : blanc requis pour le contraste, indépendant du thème (design system §12.4) */}
                        <div className="p-2 text-white h-full relative">
                            <div className="text-[10px] font-black bg-card/20 px-1.5 rounded-full inline-block">
                                {logic.formData.timeStart} -{" "}
                                {logic.formData.timeEnd}
                            </div>
                            <div className="text-xs font-bold truncate mt-1">
                                {logic.formData.participants || "Nouveau RDV"}
                            </div>
                            <div
                                onMouseDown={(e) => {
                                    e.stopPropagation()
                                    logic.handleMouseDown(e, "resize-bottom")
                                }}
                                onTouchStart={(e) => {
                                    e.stopPropagation()
                                    logic.handleMouseDown(e, "resize-bottom")
                                }}
                                // after:-inset-y-2 : la barre reste fine mais la
                                // cible tactile atteint ~28px.
                                className="absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize touch-none flex items-center justify-center after:absolute after:-inset-y-2 after:left-0 after:right-0"
                            >
                                <div className="w-8 h-1 bg-card/40 rounded-full" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
