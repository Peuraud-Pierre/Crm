import { memo, useEffect, useRef, useState } from "react"
import {
    Building2,
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    PanelRightClose,
    PanelRightOpen,
    Users,
} from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { TabsList, TabsTrigger } from "@/shared/ui/atoms/tabs"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"
import { cn } from "@/shared/lib/utils"
import { AppleConnectionButton } from "@/features/calendar-integrations/apple/components/AppleConnectionButton"
import { LiquidTabsIndicator } from "@/shared/ui/molecules/liquid-tabs-indicator"
import { useCalendarContext } from "../../context/CalendarContext"

/**
 * Bascule Agenda / Gérer les disponibilités / Fermetures entreprise, affichée
 * au même niveau que le sélecteur Jour/Semaine/Mois. `collapseLabels` replie
 * le texte en icône seule ; calculé par le parent via détection réelle de
 * débordement (voir `CalendarHeader`), pas un seuil de largeur deviné.
 */
export function CalendarSubTabs({
    isManager,
    collapseLabels,
}: {
    isManager: boolean
    collapseLabels: boolean
}) {
    const label = cn(
        "grid transition-[grid-template-columns] duration-slow ease-out",
        collapseLabels ? "grid-cols-[0fr]" : "grid-cols-[1fr]"
    )
    // `relative z-10`, la neutralisation du fond actif et la couleur du texte
    // actif sont posés par `<TabsList indicator>` sur ses descendants — voir
    // DESIGN_SYSTEM.md §13.
    const triggerClass = "gap-2 text-muted-foreground"
    return (
        <TabsList
            indicator
            indicatorClassName="rounded-sm"
            className="shrink-0 gap-1 bg-muted/50 border border-border/50"
        >
            <TabsTrigger value="agenda" className={triggerClass}>
                <CalendarDays className="h-4 w-4 shrink-0" />
                <span className={label}>
                    <span className="min-w-0 overflow-hidden whitespace-nowrap">
                        Agenda
                    </span>
                </span>
            </TabsTrigger>
            {/* Édition des disponibilités réservée aux Admins (availability.manage).
                Les commerciaux ne peuvent plus modifier leurs horaires/congés. */}
            {isManager && (
                <TabsTrigger value="manager-dispo" className={triggerClass}>
                    <Users className="h-4 w-4 shrink-0" />
                    <span className={label}>
                        <span className="min-w-0 overflow-hidden whitespace-nowrap">
                            Gérer les disponibilités
                        </span>
                    </span>
                </TabsTrigger>
            )}
            {isManager && (
                <TabsTrigger value="company-dispo" className={triggerClass}>
                    <Building2 className="h-4 w-4 shrink-0" />
                    <span className={label}>
                        <span className="min-w-0 overflow-hidden whitespace-nowrap">
                            Fermetures entreprise
                        </span>
                    </span>
                </TabsTrigger>
            )}
        </TabsList>
    )
}

export const CalendarHeader = memo(function CalendarHeader({
    isManager,
}: {
    isManager: boolean
}) {
    const {
        headerTitle,
        handleNavigate,
        goToToday,
        calendarView,
        setCalendarView,
        isSidebarOpen,
        setIsSidebarOpen,
    } = useCalendarContext()

    // Replie les libellés seulement quand la rangée déborde réellement de
    // l'espace disponible — pas un seuil de largeur deviné (jamais fiable
    // selon la taille d'écran), une vraie mesure. On calibre la largeur
    // nécessaire (scrollWidth) au moment du débordement, tant qu'on est en
    // état déplié ; une fois replié, on ne compare plus que des largeurs déjà
    // connues (clientWidth vs largeur calibrée) pour éviter toute oscillation
    // (se replier → tenir → se déplier → déborder → se replier…).
    const rowRef = useRef<HTMLDivElement>(null)
    const viewSwitcherRef = useRef<HTMLDivElement>(null)
    const requiredWidthRef = useRef<number | null>(null)
    const [collapseLabels, setCollapseLabels] = useState(false)

    useEffect(() => {
        const row = rowRef.current
        if (!row) return

        const measure = () => {
            if (!collapseLabels) {
                if (row.scrollWidth > row.clientWidth) {
                    requiredWidthRef.current = row.scrollWidth
                    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- mesure DOM de débordement réel, impossible à dériver au rendu
                    setCollapseLabels(true)
                }
            } else if (
                requiredWidthRef.current !== null &&
                row.clientWidth >= requiredWidthRef.current
            ) {
                // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- mesure DOM de débordement réel, impossible à dériver au rendu
                setCollapseLabels(false)
            }
        }

        measure()
        const resizeObserver = new ResizeObserver(measure)
        resizeObserver.observe(row)
        return () => resizeObserver.disconnect()
    }, [collapseLabels, isManager])

    // Basé sur des container queries (@3xl ≈ md) plutôt que des breakpoints
    // viewport : la largeur qui compte ici est celle du panneau calendrier,
    // qui rétrécit quand la sidebar s'ouvre sans que le viewport ne bouge —
    // du `md:` classique resterait figé en layout "large" dans ce cas.
    return (
        <div className="relative shrink-0 flex flex-col @3xl:flex-row items-stretch @3xl:items-center justify-between px-4 @3xl:px-6 py-4 border-b border-border/40 bg-background gap-4 min-w-0">
            {/* Ligne 1 : Flèches + Titre */}
            <div className="flex items-center justify-between @3xl:justify-start gap-3 w-full @3xl:w-auto shrink-0">
                {/* h-9 sous @3xl : 28px de cible tactile provoquait des mis-taps
                    entre « précédent », « aujourd'hui » et « suivant » — on
                    revient à h-7 en large pour ne pas alourdir le desktop. */}
                <div className="flex items-center gap-0.5 bg-muted/50 rounded-lg p-0.5 border border-border/50 shrink-0">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 @3xl:h-7 @3xl:w-7"
                        onClick={() => handleNavigate("prev")}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 @3xl:h-7 text-xs px-2 @3xl:px-3"
                        onClick={goToToday}
                    >
                        <span className="@3xl:hidden">Auj.</span>
                        <span className="hidden @3xl:inline">Aujourd'hui</span>
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 @3xl:h-7 @3xl:w-7"
                        onClick={() => handleNavigate("next")}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
                <h2 className="text-base @3xl:text-xl font-semibold tracking-tight first-letter:uppercase truncate flex-1 @3xl:flex-none text-right @3xl:text-left">
                    {headerTitle}
                </h2>
            </div>

            {/* Ligne 2 : Sélecteur de Vue + Actions.
                overflow-x-auto (pas overflow-hidden) : même une fois les
                libellés repliés en icônes, sur un très petit écran le reste
                (switcher de vue + actions) peut encore déborder — avec
                overflow-hidden c'était juste tronqué et inatteignable. */}
            <div
                ref={rowRef}
                className="flex items-center justify-between @3xl:justify-end gap-2 @3xl:gap-3 w-full @3xl:flex-1 min-w-0 overflow-x-auto hide-scrollbar"
            >
                <CalendarSubTabs
                    isManager={isManager}
                    collapseLabels={collapseLabels}
                />

                {/* Sélecteur de vue (compact) */}
                <div className="block @3xl:hidden flex-1 min-w-[110px]">
                    <Select
                        value={calendarView}
                        onValueChange={(v: "day" | "week" | "month" | "year") =>
                            setCalendarView(v)
                        }
                    >
                        <SelectTrigger className="h-9 w-full bg-muted/50 border-border/50 font-medium text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="day">Jour</SelectItem>
                            <SelectItem value="week">Semaine</SelectItem>
                            <SelectItem value="month">Mois</SelectItem>
                            <SelectItem value="year">Année</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Sélecteur de vue (large) */}
                <div
                    ref={viewSwitcherRef}
                    className="relative hidden @3xl:flex p-1 bg-muted/50 rounded-lg border border-border/50"
                >
                    <LiquidTabsIndicator
                        containerRef={viewSwitcherRef}
                        activeValue={calendarView}
                    />
                    {(["day", "week", "month", "year"] as const).map((v) => (
                        <button
                            key={v}
                            data-state={
                                calendarView === v ? "active" : "inactive"
                            }
                            onClick={() => setCalendarView(v)}
                            className={cn(
                                "relative z-10 px-3 py-1.5 text-[11px] font-medium rounded-md transition-colors shrink-0",
                                calendarView === v
                                    ? "text-sidebar-accent-foreground"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {v === "day"
                                ? "Jour"
                                : v === "week"
                                  ? "Semaine"
                                  : v === "month"
                                    ? "Mois"
                                    : "Année"}
                        </button>
                    ))}
                </div>

                {/* Actions à droite */}
                <div className="flex items-center gap-1 shrink-0">
                    <AppleConnectionButton />
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="shrink-0 h-9 w-9 @3xl:h-10 @3xl:w-10 bg-muted/30 @3xl:bg-transparent"
                    >
                        {isSidebarOpen ? (
                            <PanelRightClose className="h-4 w-4 @3xl:h-5 @3xl:w-5" />
                        ) : (
                            <PanelRightOpen className="h-4 w-4 @3xl:h-5 @3xl:w-5" />
                        )}
                    </Button>
                </div>
            </div>
        </div>
    )
})
