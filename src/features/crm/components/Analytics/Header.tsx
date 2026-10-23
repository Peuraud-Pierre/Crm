import { useState } from "react"
import { motion } from "framer-motion"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import type { DateRange } from "react-day-picker"
import {
    Settings2,
    CalendarDays,
    CalendarSearch,
    CalendarRange,
    Users,
    X,
} from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { Calendar } from "@/shared/ui/atoms/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/shared/ui/atoms/popover"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/shared/ui/atoms/dropdown-menu"
import { useAnalytics, type WidgetId } from "../../context/AnalyticsContext"
import { ExportStatsButton } from "./ExportStatsButton"
import { ExportRdvTypeButton } from "./ExportRdvTypeButton"
import { cn } from "@/shared/lib/utils"

export function AnalyticsHeader() {
    const {
        selectedPeriod,
        setSelectedPeriod,
        selectedFilter,
        setSelectedFilter,
        customRange,
        setCustomRange,
        availableFilters,
        selectedCommercial,
        setSelectedCommercial,
        canSelectCommercial,
        crmUsers,
        widgets,
        toggleWidget,
    } = useAnalytics()

    const [rangeOpen, setRangeOpen] = useState(false)
    // Brouillon de sélection dans le calendrier, tant que l'utilisateur n'a
    // pas cliqué sur « Appliquer » — n'affecte pas encore les stats affichées.
    const [draftRange, setDraftRange] = useState<DateRange | undefined>(() =>
        customRange
            ? { from: customRange.start, to: new Date(customRange.end.getTime() - 86_400_000) }
            : undefined
    )

    const applyCustomRange = () => {
        if (!draftRange?.from) return
        const start = new Date(draftRange.from)
        start.setHours(0, 0, 0, 0)
        // `end` exclusif : lendemain minuit du dernier jour choisi (ou du
        // premier jour si une seule date a été sélectionnée).
        const lastDay = new Date(draftRange.to ?? draftRange.from)
        lastDay.setHours(0, 0, 0, 0)
        lastDay.setDate(lastDay.getDate() + 1)
        setCustomRange({ start, end: lastDay })
        setRangeOpen(false)
    }

    const clearCustomRange = () => {
        setCustomRange(null)
        setDraftRange(undefined)
    }

    const formatFilterLabel = (val: string) => {
        if (selectedPeriod === "day") {
            const d = new Date(val)
            if (Number.isNaN(d.getTime())) return val
            const label = d.toLocaleDateString("fr-FR", {
                weekday: "long",
                day: "2-digit",
                month: "long",
                year: "numeric",
            })
            return label.charAt(0).toUpperCase() + label.slice(1)
        }
        if (selectedPeriod === "week") {
            const [year, week] = val.split("-W")
            return `Semaine ${week} (${year})`
        }
        if (selectedPeriod === "month") {
            const [year, month] = val.split("-")
            const d = new Date(Number(year), Number(month) - 1, 1)
            const monthName = d.toLocaleDateString("fr-FR", { month: "long" })
            return `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}`
        }
        if (selectedPeriod === "quarter") {
            const [year, q] = val.split("-Q")
            return `Trimestre ${q} (${year})`
        }
        return selectedPeriod === "year" ? `Année ${val}` : val
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="sticky top-0 z-20 -mx-4 px-4 sm:-mx-6 sm:px-6 py-3 backdrop-blur-xl bg-background/80 border-b border-border/40 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4"
        >
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 w-full">
                <div className="hidden sm:block">
                    <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                        Analyses détaillées
                    </h2>
                </div>
                <div className="flex items-center gap-2.5 flex-wrap w-full xl:w-auto">
                    {/* Sélecteur de collaborateur réservé aux rôles privilégiés
                        (Super Admin / Manager). Les autres rôles n'ont pas de
                        sélection : leurs stats restent verrouillées sur eux-mêmes
                        (forcé côté contexte). */}
                    {canSelectCommercial && (
                        <>
                            <Select
                                value={selectedCommercial}
                                onValueChange={setSelectedCommercial}
                            >
                                <SelectTrigger className="w-full sm:w-[200px] h-9 rounded-xl bg-background/50 border-dashed font-medium text-xs transition-colors hover:border-primary/50">
                                    <div className="flex items-center gap-2 truncate">
                                        <Users className="h-3.5 w-3.5 opacity-50 shrink-0" />
                                        <SelectValue placeholder="Collaborateur">
                                            {selectedCommercial === "all"
                                                ? "Tous les collaborateurs"
                                                : crmUsers.find(
                                                      (u) =>
                                                          u.id ===
                                                          selectedCommercial
                                                  )?.name ||
                                                  "Tous les collaborateurs"}
                                        </SelectValue>
                                    </div>
                                </SelectTrigger>
                                <SelectContent className="rounded-xl shadow-xl max-h-[300px]">
                                    <SelectItem
                                        value="all"
                                        className="font-medium text-xs"
                                    >
                                        Tous les collaborateurs
                                    </SelectItem>
                                    {crmUsers.map((u) => (
                                        <SelectItem
                                            key={u.id}
                                            value={u.id}
                                            className="text-xs font-medium"
                                        >
                                            {u.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <div className="h-6 w-px bg-border/50 hidden sm:block mx-1" />
                        </>
                    )}
                    <Select
                        value={selectedPeriod}
                        onValueChange={(v) => {
                            // setSelectedPeriod (= changeSelectedPeriod côté
                            // contexte) recale déjà selectedFilter sur le
                            // bucket courant de la nouvelle période
                            // (aujourd'hui pour "day", cette semaine pour
                            // "week"...) — ne pas l'écraser ici avec null,
                            // ce qui retombait sur « Vue globale ».
                            setSelectedPeriod(v as typeof selectedPeriod)
                        }}
                    >
                        <SelectTrigger className="w-full sm:w-[140px] h-9 bg-background/50 border-dashed">
                            <div className="flex items-center gap-2 text-xs font-medium">
                                <CalendarDays className="h-3.5 w-3.5 text-orange-500" />
                                <SelectValue />
                            </div>
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                            <SelectItem value="day">Par jour</SelectItem>
                            <SelectItem value="week">Par semaine</SelectItem>
                            <SelectItem value="month">Par mois</SelectItem>
                            <SelectItem value="quarter">
                                Par trimestre
                            </SelectItem>
                            <SelectItem value="year">Par année</SelectItem>
                        </SelectContent>
                    </Select>
                    {customRange ? (
                        <div className="flex items-center gap-1.5 h-9 px-3 rounded-lg bg-primary/5 border border-primary/20 text-primary text-xs font-medium">
                            <CalendarRange className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">
                                {format(customRange.start, "dd MMM yyyy", { locale: fr })}
                                {" → "}
                                {format(
                                    new Date(customRange.end.getTime() - 86_400_000),
                                    "dd MMM yyyy",
                                    { locale: fr }
                                )}
                            </span>
                            <button
                                type="button"
                                onClick={clearCustomRange}
                                className="ml-1 rounded-full p-0.5 hover:bg-primary/10 transition-colors"
                                aria-label="Effacer la plage personnalisée"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </div>
                    ) : (
                        <Select
                            value={selectedFilter || "none"}
                            onValueChange={(v) =>
                                setSelectedFilter(v === "none" ? null : v)
                            }
                        >
                            <SelectTrigger
                                className={cn(
                                    "w-full sm:min-w-[220px] sm:flex-1 h-9 transition-colors font-medium text-xs rounded-lg",
                                    selectedFilter
                                        ? "bg-primary/5 border-primary/20 text-primary hover:bg-primary/10"
                                        : "bg-background/50 border-dashed"
                                )}
                            >
                                <div className="flex items-center gap-2 truncate">
                                    <CalendarSearch
                                        className={cn(
                                            "h-3.5 w-3.5 shrink-0",
                                            selectedFilter
                                                ? "text-primary"
                                                : "text-muted-foreground"
                                        )}
                                    />
                                    <SelectValue placeholder="Filtrer..." />
                                </div>
                            </SelectTrigger>
                            <SelectContent className="rounded-xl max-h-[300px]">
                                <SelectItem
                                    value="none"
                                    className="text-muted-foreground italic text-xs"
                                >
                                    Vue globale
                                </SelectItem>
                                {availableFilters.map((f) => (
                                    <SelectItem
                                        key={f}
                                        value={f}
                                        className="text-xs font-medium"
                                    >
                                        {formatFilterLabel(f)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                    <Popover open={rangeOpen} onOpenChange={setRangeOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className={cn(
                                    "h-9 gap-2 rounded-lg border-dashed text-xs font-medium shrink-0",
                                    customRange &&
                                        "bg-primary/5 border-primary/20 text-primary hover:bg-primary/10"
                                )}
                                title="Plage personnalisée"
                            >
                                <CalendarRange className="h-3.5 w-3.5" />
                                <span className="hidden xl:inline">
                                    Plage personnalisée
                                </span>
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <div className="flex flex-col gap-0">
                                <div className="px-3 pt-3 pb-1">
                                    <p className="text-xs font-medium text-foreground">
                                        Charger les stats du ... au ...
                                    </p>
                                    <p className="text-2xs text-muted-foreground mt-0.5">
                                        Remplace le filtre par période
                                    </p>
                                </div>
                                <Calendar
                                    mode="range"
                                    selected={draftRange}
                                    onSelect={setDraftRange}
                                    locale={fr}
                                    numberOfMonths={2}
                                    className="rounded-md"
                                />
                                <div className="flex items-center justify-between px-3 pb-3 pt-1 gap-2 border-t border-border/50">
                                    <span className="text-2xs text-muted-foreground truncate">
                                        {draftRange?.from
                                            ? `${format(draftRange.from, "dd/MM/yy")} → ${
                                                  draftRange.to
                                                      ? format(draftRange.to, "dd/MM/yy")
                                                      : "?"
                                              }`
                                            : "Sélectionne une plage"}
                                    </span>
                                    <Button
                                        size="sm"
                                        className="h-7 gap-1.5 text-xs shrink-0"
                                        disabled={!draftRange?.from}
                                        onClick={applyCustomRange}
                                    >
                                        Appliquer
                                    </Button>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>
            </div>

            <div className="flex items-center gap-2 w-full lg:w-auto">
                {canSelectCommercial && (
                    <>
                        <ExportStatsButton />
                        <ExportRdvTypeButton />
                    </>
                )}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full lg:w-auto h-9 gap-2 rounded-xl border-dashed"
                        >
                            <Settings2 className="h-4 w-4 shrink-0" />{" "}
                            Personnaliser
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        align="end"
                        className="w-56 rounded-xl shadow-xl"
                    >
                        <DropdownMenuLabel>Affichage</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {Object.values(widgets).map((w) => (
                            <DropdownMenuCheckboxItem
                                key={w.id}
                                checked={w.visible}
                                onCheckedChange={() =>
                                    toggleWidget(w.id as WidgetId)
                                }
                            >
                                {w.title}
                            </DropdownMenuCheckboxItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </motion.div>
    )
}
