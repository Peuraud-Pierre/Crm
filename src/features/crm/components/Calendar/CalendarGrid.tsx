import { memo } from "react"
import {
    addDays,
    startOfWeek,
    eachDayOfInterval,
    startOfYear,
    endOfYear,
    eachMonthOfInterval,
} from "date-fns"
import { useCRMContext } from "@/features/crm/context/CRMContext"
import { useCalendarContext } from "../../context/CalendarContext"

import { DayView } from "./DayView"
import { WeekViewGrid } from "./WeekView"
import { MonthYearGrid, generateMonthGrid } from "./MonthView"

export const CalendarGrid = memo(function CalendarGrid() {
    const { eventsForCurrentDay } = useCRMContext()
    const {
        calendarView,
        date,
        setDate,
        currentMonth,
        setCurrentMonth,
        handleCreateEvent,
        setCalendarView,
    } = useCalendarContext()

    return (
        <div className="flex-1 overflow-hidden bg-background/50 p-1">
            {calendarView === "day" && (
                <DayView
                    eventsForCurrentDay={eventsForCurrentDay}
                    handleDayDoubleClick={handleCreateEvent}
                />
            )}

            {calendarView === "week" && (
                <WeekViewGrid
                    // Lundi → vendredi uniquement (weekStartsOn: 1 = lundi, +4
                    // jours = vendredi) : week-end masqué de la grille semaine.
                    daysToRender={eachDayOfInterval({
                        start: startOfWeek(date, { weekStartsOn: 1 }),
                        end: addDays(startOfWeek(date, { weekStartsOn: 1 }), 4),
                    })}
                    date={date}
                    handleDayClick={setDate}
                    handleDayDoubleClick={handleCreateEvent}
                />
            )}

            {calendarView === "month" && (
                <MonthYearGrid
                    daysToRender={generateMonthGrid(currentMonth)}
                    handleDayClick={setDate}
                    handleDayDoubleClick={(d) => {
                        setDate(d)
                        setCalendarView("day")
                    }}
                />
            )}

            {calendarView === "year" && (
                <MonthYearGrid
                    daysToRender={eachMonthOfInterval({
                        start: startOfYear(currentMonth),
                        end: endOfYear(currentMonth),
                    })}
                    handleDayClick={(monthDate) => {
                        setDate(monthDate)
                        setCurrentMonth(monthDate)
                    }}
                    handleDayDoubleClick={(monthDate) => {
                        setDate(monthDate)
                        setCurrentMonth(monthDate)
                        setCalendarView("month")
                    }}
                />
            )}
        </div>
    )
})
