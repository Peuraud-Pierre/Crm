import type { UseQueryResult } from "@tanstack/react-query"
import { useState } from "react"
import { cn } from "@/shared/lib/utils"
import { Button } from "@/shared/ui/atoms/button"
import { Label } from "@/shared/ui/atoms/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"
import {
    SearchSelect,
    type SearchSelectOption,
} from "@/shared/ui/molecules/search-select"
import {
    PERIOD_OPTIONS,
    type useMatomoFilters,
} from "@/features/matomo/routes/matomoFilters"
import type { MatomoSite } from "./types"

/** Même habillage que les libellés de SearchSelect : la barre reste homogène. */
const FILTER_LABEL = "text-xs font-bold uppercase tracking-wider text-muted-foreground"

interface MatomoConfigBarProps {
    filters: ReturnType<typeof useMatomoFilters>
    sites: UseQueryResult<MatomoSite[]>
    fetching: boolean
    refresh: () => void
    /** `undefined` tant que le premier relevé n'est pas arrivé. */
    live: number | undefined
    /** Horodatage (ms) des KPI affichés, 0 tant qu'aucun n'est arrivé. */
    updatedAt: number
}

export default function MatomoConfigBar({
    filters,
    sites,
    fetching,
    refresh,
    live,
    updatedAt,
}: MatomoConfigBarProps) {
    // Pendant un changement de filtre, les données provisoires n'ont pas
    // d'horodatage (0) : on garde la dernière heure connue plutôt que de la
    // faire disparaître le temps du rechargement.
    // Ajustement d'état pendant le rendu (modèle recommandé par React), pas de ref.
    const [shownUpdate, setShownUpdate] = useState(updatedAt)
    if (updatedAt > 0 && updatedAt !== shownUpdate) setShownUpdate(updatedAt)

    const siteList = sites.data ?? []
    const { siteId } = filters.query

    const siteOptions: SearchSelectOption[] =
        siteList.length > 0
            ? siteList.map((site) => ({
                  value: site.idsite,
                  label: site.name,
                  subLabel: site.main_url,
              }))
            : // Tant que la liste n'est pas là, le site courant reste nommé.
              [
                  {
                      value: siteId,
                      label: sites.isPending ? "Chargement des sites…" : `Site n° ${siteId}`,
                  },
              ]

    // Composants du design system (DESIGN_SYSTEM.md §14.3) : SearchSelect pour
    // les sites, référentiel qui grandit avec les données ; Select pour les
    // énumérations courtes et fermées. Ils remplacent des <select> natifs sans
    // anneau de focus, qui zoomaient la page sur iOS.
    return (
        <div className="grid grid-cols-1 gap-3 rounded-lg border bg-card p-3 shadow-sm sm:flex sm:flex-wrap sm:items-end sm:gap-4 sm:p-4">
            {/* SearchSelect affiche son libellé sans le relier au déclencheur :
                le groupe porte le nom accessible. */}
            <div role="group" aria-label="Site" className="min-w-0 sm:w-64">
                <SearchSelect
                    label="Site"
                    variant="button"
                    searchable
                    options={siteOptions}
                    value={siteId}
                    onChange={(value) => filters.setSite(value)}
                    emptyMessage="Aucun site ne correspond."
                />
            </div>

            <div className="flex min-w-0 flex-col gap-2">
                <Label htmlFor="matomo-period" className={FILTER_LABEL}>
                    Période
                </Label>
                <Select value={filters.periodKey} onValueChange={filters.setPeriodKey}>
                    <SelectTrigger id="matomo-period" className="sm:w-52">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {PERIOD_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                                {o.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <Button
                variant="outline"
                onClick={refresh}
                loading={fetching}
                className="w-full sm:w-auto"
            >
                Rafraîchir
            </Button>

            {/* Fraîcheur + temps réel : indicateurs d'ambiance, pas des données
                de pilotage. Ils restent discrets en bout de barre. Le point
                n'est vert que s'il y a du monde ; rien n'est affiché tant que le
                premier relevé manque (un « 0 » ferait croire à un site mort). */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground sm:ml-auto sm:h-10">
                {shownUpdate > 0 && (
                    <span className="tabular-nums">
                        Mis à jour à{" "}
                        {new Date(shownUpdate).toLocaleTimeString("fr-FR", {
                            hour: "2-digit",
                            minute: "2-digit",
                        })}
                    </span>
                )}
                {live !== undefined && (
                    // Pas de role="status" : relu chaque minute, il ferait
                    // annoncer le compteur en boucle par les lecteurs d'écran.
                    <span
                        className="flex items-center gap-2"
                        // « En ligne » = actif ces 30 dernières minutes (Live.getCounters).
                        title="Visiteurs actifs ces 30 dernières minutes"
                    >
                        <span
                            aria-hidden
                            className={cn(
                                "size-2 rounded-full",
                                live > 0 ? "bg-brand" : "bg-muted-foreground/40"
                            )}
                        />
                        <span className="tabular-nums">
                            {live.toLocaleString("fr-FR")}
                        </span>
                        {live > 1 ? "visiteurs en ligne" : "visiteur en ligne"}
                        <span className="sr-only"> (30 dernières minutes)</span>
                    </span>
                )}
            </div>

            {sites.isError && (
                <p role="alert" className="text-sm text-destructive sm:basis-full">
                    Liste des sites indisponible : {sites.error.message}
                </p>
            )}
        </div>
    )
}
