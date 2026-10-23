import { memo, type ComponentType, type ReactNode } from "react"
import { Filter, Lock, User, X } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"
import { Separator } from "@/shared/ui/atoms/separator"
import { useCalendarContext } from "../../context/CalendarContext"
import { useAuth } from "@/features/auth/hooks/useAuth"

interface SelectFilterProps {
    value: string
    onChange: (value: string) => void
    icon: ComponentType<{ className?: string }>
    placeholder: string
    width: string
    children: ReactNode
}

const SelectFilter = ({
    value,
    onChange,
    icon: Icon,
    placeholder,
    width,
    children,
}: SelectFilterProps) => (
    <Select value={value} onValueChange={onChange}>
        <SelectTrigger
            style={{ width }}
            className="h-9 text-xs border-dashed border-border bg-muted/60 hover:bg-muted/90 transition-colors"
        >
            <div className="flex items-center gap-2 truncate">
                <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
                <SelectValue placeholder={placeholder} />
            </div>
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
    </Select>
)

export const CalendarFilterBar = memo(function CalendarFilterBar() {
    const { user } = useAuth()
    const { calendarView, userFilter, setUserFilter, teamMembers } =
        useCalendarContext()

    // Mois & semaine : ensemble fixe (agendas fixes + le vôtre) → le filtre
    // gestionnaire n'a aucun effet, on le masque au profit d'une note.
    const isFixedSetView = calendarView === "month" || calendarView === "week"

    return (
        // `relative z-0` : la barre reste dans le plan de fond du calendrier.
        // Les menus des Select sont portalisés par Radix, ils n'ont donc pas
        // besoin que ce conteneur monte dans la pile.
        <div className="relative w-full bg-muted/60 border-b border-border/40 backdrop-blur-sm z-0 overflow-x-auto hide-scrollbar">
            <div className="flex items-center gap-3 p-2 px-4 md:px-6 w-max min-w-full">
                <div className="relative z-0 flex items-center gap-2 text-[10px] uppercase tracking-wider font-bold text-muted-foreground mr-2 shrink-0">
                    <Filter className="h-3 w-3" />
                    <span>Filtrer par</span>
                </div>

                {!isFixedSetView && user?.service !== "Accueil" && (
                    <div className="shrink-0">
                        <SelectFilter
                            value={userFilter}
                            onChange={setUserFilter}
                            icon={User}
                            placeholder="Gestionnaire"
                            width="160px"
                        >
                            <SelectItem value="all">Toute l'équipe</SelectItem>
                            <SelectItem value="mine">Mon agenda</SelectItem>
                            <Separator className="my-1" />
                            {teamMembers.map((u) => (
                                <SelectItem key={u.user_id} value={u.user_id}>
                                    {u.name}
                                </SelectItem>
                            ))}
                        </SelectFilter>
                    </div>
                )}

                {isFixedSetView && (
                    <div className="flex items-center gap-1.5 text-[10px] text-orange-600 bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30 px-2 py-1 rounded-md shrink-0">
                        <Lock className="h-3 w-3" />
                        <span>Agendas : équipe fixe + le vôtre</span>
                    </div>
                )}

                {userFilter !== "all" && !isFixedSetView && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setUserFilter("all")}
                        className="h-9 px-2 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                    >
                        <X className="h-4 w-4 mr-1" />
                        <span className="text-xs">Effacer</span>
                    </Button>
                )}
            </div>
        </div>
    )
})
