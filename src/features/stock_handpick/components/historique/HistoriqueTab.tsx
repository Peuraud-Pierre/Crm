import { useMemo, useState } from "react"
import { History, X } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"
import { FilterBar, countActiveFilters } from "@/shared/ui/organisms/filter-bar"
import { ActivityFeed } from "@/shared/ui/organisms/activity-feed"
import { SearchSelect } from "@/shared/ui/molecules/search-select"
import type { SearchSelectOption } from "@/shared/ui/molecules/search-select"
import { HANDPICK_THEME } from "@/features/stock_handpick/theme"
import { useHistoryHandpick } from "@/features/stock_handpick/hooks/data/useHistoryHandpick"
import {
    DEFAULT_HANDPICK_HISTORY_FILTERS,
    HANDPICK_ACTION_LABEL,
    HANDPICK_ENTITY_LABEL,
    type HandpickAction,
    type HandpickEntityType,
    type HandpickLogGroup,
} from "@/features/stock_handpick/types/history.types"
import { ACTION_ICON, ENTITY_ICON, timeAgo } from "@/features/stock_handpick/utils/activityHelpers"
import { entityDisplayLabel } from "@/features/stock_handpick/utils/historyHelpers"
import { LogGroupSheet } from "./LogGroupSheet"

const ALL = "all"

/**
 * Vocabulaire passé au feed partagé : c'est par là que « balle » ou
 * « mouvement » lui parviennent, le socle n'en connaissant aucun.
 */
const VOCABULARY = {
    entityLabel: HANDPICK_ENTITY_LABEL as Record<string, string>,
    entityIcon: ENTITY_ICON as Record<string, React.ReactNode>,
    actionLabel: HANDPICK_ACTION_LABEL as Record<string, string>,
    actionIcon: ACTION_ICON as Record<string, React.ReactNode>,
}

export default function HistoriqueTab() {
    const {
        groups,
        authors,
        loading,
        filters,
        setFilters,
        resetFilters,
        hasActiveFilters,
    } = useHistoryHandpick()

    // État purement local : ce détail n'est pas deep-linké. Le contrat d'URL du
    // module réserve le segment `detail` aux ressources métier (une balle, un
    // mouvement) ; un groupe de journal n'en est pas une — il est recalculé à
    // chaque chargement et son id ne survit pas à un refetch.
    const [openGroup, setOpenGroup] = useState<HandpickLogGroup | null>(null)
    const [filtersOpen, setFiltersOpen] = useState(false)

    // Le socle attend `count` / `entityLabel` / `description` ; le groupe du
    // module porte `entries`. `source` reconduit le groupe d'origine jusqu'à la
    // sheet de détail, qui a besoin de la forme complète.
    const feedGroups = useMemo(
        () =>
            groups.map((group) => ({
                key: group.id,
                action: group.action,
                entity_type: group.entity_type,
                user_id: group.user_id,
                created_at: group.created_at,
                count: group.entries.length,
                entityLabel: entityDisplayLabel(group.entries[0]),
                description: group.entries[0].description,
                source: group,
            })),
        [groups],
    )

    const feedAuthors = useMemo(
        () => new Map(groups.map((group) => [group.user_id ?? "", group.user_name])),
        [groups],
    )

    const authorOptions: SearchSelectOption[] = [
        { value: ALL, label: "Tous les auteurs" },
        ...authors.map((author) => ({ value: author.id, label: author.name })),
    ]

    return (
        <div className={HANDPICK_THEME.board.container}>
            <FilterBar
                theme={HANDPICK_THEME.filterBar}
                activeCount={countActiveFilters(
                    filters,
                    DEFAULT_HANDPICK_HISTORY_FILTERS,
                    ["search"],
                )}
                open={filtersOpen}
                onOpenChange={setFiltersOpen}
                search={{
                    value: filters.search,
                    onChange: (value) => setFilters({ ...filters, search: value }),
                    placeholder: "Rechercher dans le journal…",
                    ariaLabel: "Rechercher dans le journal",
                }}
            >
                <div className="flex min-w-max items-end gap-2">
                    <div className="flex flex-col gap-1.5">
                        <span className={HANDPICK_THEME.filterBar.panelLabel}>Type</span>
                        <Select
                            value={filters.entity_type}
                            onValueChange={(value) =>
                                setFilters({
                                    ...filters,
                                    entity_type: value as HandpickEntityType | "all",
                                })
                            }
                        >
                            <SelectTrigger className="h-8 w-52 text-xs" aria-label="Filtrer par type">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ALL}>Tous les types</SelectItem>
                                {Object.entries(HANDPICK_ENTITY_LABEL).map(([key, label]) => (
                                    <SelectItem key={key} value={key}>
                                        {label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <span className={HANDPICK_THEME.filterBar.panelLabel}>Action</span>
                        <Select
                            value={filters.action}
                            onValueChange={(value) =>
                                setFilters({ ...filters, action: value as HandpickAction | "all" })
                            }
                        >
                            <SelectTrigger className="h-8 w-44 text-xs" aria-label="Filtrer par action">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ALL}>Toutes les actions</SelectItem>
                                {Object.entries(HANDPICK_ACTION_LABEL).map(([key, label]) => (
                                    <SelectItem key={key} value={key}>
                                        {label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Liste de personnes : elle grandit avec l'équipe, donc
                        cherchable — contrairement aux deux énumérations. */}
                    <SearchSelect
                        label="Auteur"
                        searchable
                        size="sm"
                        options={authorOptions}
                        value={filters.user_id}
                        onChange={(value) => setFilters({ ...filters, user_id: value })}
                        className="w-52"
                        emptyMessage="Aucun auteur"
                    />

                    {hasActiveFilters && (
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-destructive"
                            onClick={resetFilters}
                        >
                            <X size={12} />
                            Réinitialiser
                        </Button>
                    )}
                </div>
            </FilterBar>

            <ActivityFeed
                groups={feedGroups}
                loading={loading}
                vocabulary={VOCABULARY}
                theme={HANDPICK_THEME}
                // Le nom de l'auteur est déjà résolu par le groupement.
                userName={(userId) => feedAuthors.get(userId ?? "") ?? null}
                formatTime={timeAgo}
                empty={{
                    icon: History,
                    title: hasActiveFilters ? "Aucun résultat" : "Journal vide",
                    description: hasActiveFilters
                        ? "Aucune entrée ne correspond aux filtres actifs."
                        : "Les actions sur le stock apparaîtront ici au fil de l'eau.",
                    action: hasActiveFilters
                        ? { label: "Réinitialiser les filtres", onClick: resetFilters }
                        : undefined,
                }}
                onSelect={(group) => setOpenGroup(group.source)}
            />

            <LogGroupSheet group={openGroup} onClose={() => setOpenGroup(null)} />
        </div>
    )
}
