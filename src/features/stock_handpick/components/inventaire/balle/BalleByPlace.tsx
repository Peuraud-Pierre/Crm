import { useMemo } from "react"
import { Filter, MapPin } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { cn } from "@/shared/lib/utils"
import { HANDPICK_THEME } from "@/features/stock_handpick/theme"
import type { BalleHandpick } from "@/features/stock_handpick/types/balle.types"
import {
    PLACE_ALL,
    PLACE_BORROWED,
    PLACE_ECLATEE,
    PLACE_UNPLACED,
    groupBallesByPlace,
    matchesPlace,
    placeLabel,
    type SegmentsFor,
} from "@/features/stock_handpick/utils/placeGroups"
import { PLAN_ZONES, type PlanZoneCode } from "@/features/stock_handpick/utils/planLayout"
import { BalleCard } from "./BalleCard"
import { selectionStateOf } from "@/features/stock_handpick/hooks/ui/useBalleSelection"
import { BalleEclateesSection } from "./BalleEclateesSection"

const numberFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 })

interface BalleByPlaceProps {
    /** Balles à afficher, filtres appliqués. */
    balles: BalleHandpick[]
    /** Palier chargé, sans filtre : sert au décompte des raccourcis. */
    allBalles: BalleHandpick[]
    emplacementPath: (emplacementId: string | null | undefined) => string | null
    segmentsFor: SegmentsFor
    place: string
    onPlaceChange: (place: string) => void
    onOpen: (balle: BalleHandpick) => void
    /** Mode sélection : ids cochés. Absent hors mode sélection. */
    selectedIds?: ReadonlySet<string>
}

/** Clé de filtre d'un groupe : les « non rangées » se filtrent ensemble. */
const filterKeyOf = (groupKey: string) =>
    groupKey.startsWith(`${PLACE_UNPLACED}:`) ? PLACE_UNPLACED : groupKey

/**
 * Inventaire rangé comme l'entrepôt : un bloc par rack (ou par zone quand
 * elle n'a pas de rack), puis les balles empruntées et celles sans
 * emplacement.
 *
 * Les raccourcis du haut filtrent d'un clic sur une zone ; chaque bloc
 * propose aussi de ne garder que lui. Le décompte porte sur le palier
 * chargé, comme le reste des filtres de l'inventaire.
 */
export function BalleByPlace({
    balles,
    allBalles,
    emplacementPath,
    segmentsFor,
    place,
    onPlaceChange,
    onOpen,
    selectedIds,
}: BalleByPlaceProps) {
    const groups = useMemo(() => groupBallesByPlace(balles, segmentsFor), [balles, segmentsFor])

    const shortcuts = useMemo(() => {
        const keys = [PLACE_ALL, ...(Object.keys(PLAN_ZONES) as PlanZoneCode[]).sort(
            (a, b) => ["B", "A", "D"].indexOf(a) - ["B", "A", "D"].indexOf(b),
        ), PLACE_BORROWED, PLACE_UNPLACED, PLACE_ECLATEE]
        return keys.map((key) => ({
            key,
            label: key === PLACE_ALL ? "Tout" : key.length === 1 ? `Zone ${key}` : placeLabel(key),
            count: allBalles.filter((balle) => matchesPlace(balle, key, segmentsFor)).length,
        }))
    }, [allBalles, segmentsFor])

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrer par emplacement">
                {shortcuts.map(({ key, label, count }) => {
                    const active = place === key
                    return (
                        <Button
                            key={key}
                            size="sm"
                            variant={active ? "default" : "outline"}
                            aria-pressed={active}
                            onClick={() => onPlaceChange(key)}
                            className="h-8 gap-1.5 text-xs"
                        >
                            {label}
                            <span className={cn("tabular-nums", active ? "opacity-80" : "text-muted-foreground")}>
                                {count}
                            </span>
                        </Button>
                    )
                })}
            </div>

            {groups.map((group) => {
                if (group.key === PLACE_ECLATEE) {
                    return (
                        <BalleEclateesSection
                            key={group.key}
                            label={group.label}
                            balles={group.balles}
                            onOpen={onOpen}
                        />
                    )
                }
                const weight = group.balles
                    .filter((b) => b.packing_mode === "kilos" && b.packing !== null)
                    .reduce((sum, b) => sum + (b.packing ?? 0), 0)
                const filterKey = filterKeyOf(group.key)
                return (
                    <section key={group.key} className="space-y-2" aria-label={group.label}>
                        <div className="flex flex-wrap items-center gap-2 border-b border-border pb-1.5">
                            <MapPin size={14} className="shrink-0 text-muted-foreground" aria-hidden />
                            <h3 className="text-sm font-semibold text-foreground">{group.label}</h3>
                            <span className="text-xs tabular-nums text-muted-foreground">
                                {group.balles.length} balle{group.balles.length > 1 ? "s" : ""}
                                {weight > 0 && ` · ${numberFormatter.format(weight)} kg`}
                            </span>
                            {place !== filterKey && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="ml-auto h-7 gap-1 text-xs text-muted-foreground"
                                    onClick={() => onPlaceChange(filterKey)}
                                >
                                    <Filter size={12} aria-hidden />
                                    Voir seulement
                                </Button>
                            )}
                        </div>
                        <div className={HANDPICK_THEME.board.grid}>
                            {group.balles.map((balle) => (
                                <BalleCard
                                    key={balle.id}
                                    balle={balle}
                                    emplacementPath={emplacementPath(balle.emplacement_id)}
                                    onClick={() => onOpen(balle)}
                                    selection={selectionStateOf(selectedIds, balle)}
                                />
                            ))}
                        </div>
                    </section>
                )
            })}
        </div>
    )
}
