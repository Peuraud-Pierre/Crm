import React, {
    createContext,
    use,
    useEffect,
    useState,
    useMemo,
    useCallback,
    type ReactNode,
} from "react"
import {
    addDays,
    addMonths,
    addYears,
    format,
    startOfMonth,
    startOfWeek,
    startOfYear,
} from "date-fns"
import { fr } from "date-fns/locale"
import { useCRMContext } from "@/features/crm/context/CRMContext"
import { useAuth } from "@/features/auth/hooks/useAuth"
import type { Event_creation, Search, CalendarView } from "@/features/crm/types"

interface CalendarContextType {
    date: Date
    setDate: (date: Date) => void
    currentMonth: Date
    setCurrentMonth: (date: Date) => void
    calendarView: "day" | "week" | "month" | "year"
    setCalendarView: (view: "day" | "week" | "month" | "year") => void
    userFilter: string
    setUserFilter: (filter: string) => void
    isSidebarOpen: boolean
    setIsSidebarOpen: (isOpen: boolean) => void
    headerTitle: string
    teamMembers: Search[]
    handleNavigate: (direction: "prev" | "next") => void
    handleCreateEvent: (targetDate?: Date) => void
    goToToday: () => void
    // ✅ 2. Ajout des types pour la gestion de la popup de l'événement
    selectedEventInfo: Event_creation | null
    setSelectedEventInfo: React.Dispatch<
        React.SetStateAction<Event_creation | null>
    >
}

const CalendarContext = createContext<CalendarContextType | undefined>(
    undefined
)

export function CalendarProvider({ children }: { children: ReactNode }) {
    const {
        fetch_calendar_event,
        setUpdate,
        setCreationevent,
        setCreation,
        date,
        setDate,
        calendarView,
        setCalendarView,
        search,
        fetch_research,
        isSidebarOpen,
        setIsSidebarOpen,
    } = useCRMContext()

    const { user } = useAuth()
    // Heure locale (cohérent avec handleNavigate/goToToday) : initialiser en
    // UTC décalait le mois affiché pour les fuseaux positifs en fin de mois.
    const [currentMonth, setCurrentMonth] = useState<Date>(() => new Date())
    const [userFilter, setUserFilter] = useState<string>("all")

    // ✅ 3. Création du state global pour gérer l'événement sélectionné (la popup)
    const [selectedEventInfo, setSelectedEventInfo] =
        useState<Event_creation | null>(null)

    // --- CHARGEMENT DES DONNÉES ---
    useEffect(() => {
        if (user?.user_id) fetch_research()
        // user?.user_id (primitif) et non l'objet `user` : ce dernier change de
        // référence à chaque event auth (refresh de token) et refait alors un
        // scan complet de client_crm pour rien.
    }, [user?.user_id, fetch_research])

    // Portée du fetch des événements, dérivée en une clé STABLE :
    // - Vues MOIS & SEMAINE : ensemble fixe (tous les agendas) → pas de filtre
    //   (undefined). Basculer mois ↔ semaine ne change pas la clé → pas de
    //   re-fetch inutile (les deux vues affichent la même donnée).
    // - Vues JOUR & ANNÉE : filtre gestionnaire classique.
    const eventOwnerScope = useMemo(() => {
        if (calendarView === "month" || calendarView === "week") return undefined
        return userFilter === "mine" ? user?.user_id : userFilter
    }, [calendarView, userFilter, user?.user_id])

    // Fenêtre de dates chargée, au lieu de tout l'historique : l'année affichée
    // en vue année, sinon le mois de référence ± 1 mois (la grille mois déborde
    // sur les semaines voisines, une semaine peut chevaucher deux mois).
    // Bornes en chaînes ISO : naviguer jour par jour dans le même mois ne
    // change pas la clé → pas de re-fetch.
    const anchor = calendarView === "day" || calendarView === "week" ? date : currentMonth
    const rangeFrom = (
        calendarView === "year"
            ? startOfYear(anchor)
            : addMonths(startOfMonth(anchor), -1)
    ).toISOString()
    const rangeTo = (
        calendarView === "year"
            ? addYears(startOfYear(anchor), 1)
            : addMonths(startOfMonth(anchor), 2)
    ).toISOString()

    useEffect(() => {
        // Ne dépend plus de `creationEvent` : ouvrir/fermer la modale de création
        // ne doit pas redéclencher un scan complet de l'agenda (le realtime + les
        // updates optimistes maintiennent déjà la liste à jour).
        fetch_calendar_event(eventOwnerScope, { from: rangeFrom, to: rangeTo })
    }, [eventOwnerScope, rangeFrom, rangeTo, fetch_calendar_event])

    // --- UTILISATEURS ---
    const teamMembers = useMemo(() => {
        if (!search) return []
        return search.filter((u) => u.user_id !== user?.user_id)
    }, [search, user])

    // --- NAVIGATION ---
    const handleNavigate = useCallback(
        (direction: "prev" | "next") => {
            const factor = direction === "next" ? 1 : -1
            const map: Record<CalendarView, (d: Date, f: number) => Date> = {
                day: addDays,
                week: (d, f) => addDays(d, f * 7),
                month: addMonths,
                year: addYears,
            }
            const baseDate = calendarView === "year" ? currentMonth : date
            const newDate = map[calendarView](baseDate, factor)

            setDate(newDate)
            setCurrentMonth(newDate)
        },
        [date, currentMonth, calendarView, setDate, setCurrentMonth]
    )

    const goToToday = useCallback(() => {
        const now = new Date()
        setDate(now)
        setCurrentMonth(now)
    }, [setDate, setCurrentMonth])

    const handleCreateEvent = useCallback(
        (targetDate?: Date) => {
            if (targetDate) setDate(targetDate)
            // Les suggestions de client de la modale passent par
            // useClientSearch : plus de rechargement de la liste ici.
            setUpdate(false)
            setCreation(true)
            setCreationevent(true)
        },
        [setUpdate, setCreation, setCreationevent, setDate]
    )

    // --- FORMATAGE DU TITRE ---
    const headerTitle = useMemo(() => {
        if (calendarView === "day")
            return format(date, "d MMMM yyyy", { locale: fr })
        if (calendarView === "week") {
            const start = startOfWeek(date, { weekStartsOn: 1 })
            return `${format(start, "d MMM", { locale: fr })} - ${format(addDays(start, 6), "d MMM yyyy", { locale: fr })}`
        }
        return format(
            currentMonth,
            calendarView === "month" ? "MMMM yyyy" : "yyyy",
            { locale: fr }
        )
    }, [calendarView, date, currentMonth])

    return (
        <CalendarContext
            value={{
                date,
                setDate,
                currentMonth,
                setCurrentMonth,
                calendarView,
                setCalendarView,
                userFilter,
                setUserFilter,
                isSidebarOpen,
                setIsSidebarOpen,
                headerTitle,
                teamMembers,
                handleNavigate,
                handleCreateEvent,
                goToToday,
                // ✅ 4. On expose le state et son setter au reste de l'application
                selectedEventInfo,
                setSelectedEventInfo,
            }}
        >
            {children}
        </CalendarContext>
    )
}

export const useCalendarContext = () => {
    const context = use(CalendarContext)
    if (!context)
        throw new Error(
            "useCalendarContext doit être utilisé dans un CalendarProvider"
        )
    return context
}
