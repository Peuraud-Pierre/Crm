import { useMemo } from "react"
import { AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, Gauge, Package, Scale, Star } from "lucide-react"
import { StatTile } from "@/shared/components/misc/StatTile"
import { SkeletonStatTiles } from "@/shared/ui/molecules/skeleton-presets"
import { cn } from "@/shared/lib/utils"
import { useTriContext } from "@/features/salle-de-tri/hooks/context/TriContext"
import { computeTriAnalytics, formatEcart, formatKg } from "@/features/salle-de-tri/utils/triAnalytics"

const fr = (n: number, digits = 0) => n.toLocaleString("fr-FR", { maximumFractionDigits: digits })

/**
 * Les chiffres de la sélection en cours (filtres compris), au-dessus des
 * fiches comme des statistiques : on lit le même périmètre dans les deux
 * vues. Sous chaque chiffre, son évolution par rapport à la période
 * précédente de même durée. La tuile des écarts filtre les fiches concernées.
 *
 * Mise en page : le poids trié sur toute la largeur puis deux par deux
 * jusqu'à la tablette, les cinq sur une ligne au-delà.
 */
export function TriKpis() {
    const { filtered, loading, filters, setFilters, trend } = useTriContext()
    const t = useMemo(() => computeTriAnalytics(filtered).totals, [filtered])

    if (loading) return <SkeletonStatTiles count={5} />

    const enEcart = t.ecarts.balles > 0

    return (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <div className="col-span-2 lg:col-span-1">
                <StatTile
                    index={0}
                    icon={Scale}
                    label="Poids trié"
                    value={formatKg(t.kg)}
                    tone="primary"
                    hint={<Trend value={trend?.kg ?? null} format={(v) => `${fr(Math.abs(v) * 100)} %`} />}
                />
            </div>
            <StatTile
                index={1}
                icon={Package}
                label="Balles triées"
                value={t.balles}
                hint={`${t.fiches} fiche${t.fiches > 1 ? "s" : ""}`}
            />
            <StatTile
                index={2}
                icon={Gauge}
                label="Productivité"
                value={t.kgParHeure === null ? "—" : `${Math.round(t.kgParHeure)} kg/h`}
                hint={<Trend value={trend?.kgParHeure ?? null} format={(v) => `${fr(Math.abs(v) * 100)} %`} />}
            />
            <StatTile
                index={3}
                icon={Star}
                label="Qualité moyenne / 3"
                value={t.qualite === null ? "—" : fr(t.qualite, 2)}
                tone="warning"
                hint={<Trend value={trend?.qualite ?? null} format={(v) => `${fr(Math.abs(v), 2)} ★`} threshold={0.05} />}
            />
            <StatTile
                index={4}
                icon={AlertTriangle}
                label={filters.ecartsSeuls ? "Écarts — filtre actif" : "Balles en écart"}
                value={enEcart ? t.ecarts.balles : "Aucune"}
                tone={enEcart ? "destructive" : "success"}
                hint={(
                    <span className="inline-flex items-center gap-1.5">
                        {enEcart && <span className="tabular-nums">{formatEcart(t.ecarts.kg)}</span>}
                        <Trend value={trend?.ecarts ?? null} format={(v) => `${Math.abs(v)}`} higherIsBetter={false} />
                    </span>
                )}
                onClick={enEcart || filters.ecartsSeuls ? () => setFilters({ ...filters, ecartsSeuls: !filters.ecartsSeuls }) : undefined}
                active={filters.ecartsSeuls}
            />
        </div>
    )
}

interface TrendProps {
    /** Variation ; `null` : rien à comparer, rien d'affiché. */
    value: number | null
    format: (value: number) => string
    /** Les écarts qui montent sont une mauvaise nouvelle. */
    higherIsBetter?: boolean
    /** En deçà, la variation est dite stable. */
    threshold?: number
}

/** « ↗ 12 % » vert, « ↘ 3 % » rouge, « → stable » — par rapport à la période précédente. */
function Trend({ value, format, higherIsBetter = true, threshold = 0.005 }: TrendProps) {
    if (value === null) return null
    const stable = Math.abs(value) < threshold
    const good = stable ? null : (value > 0) === higherIsBetter
    const Icon = stable ? ArrowRight : value > 0 ? ArrowUpRight : ArrowDownRight
    return (
        <span
            className={cn(
                "inline-flex items-center gap-0.5 font-medium tabular-nums",
                good === null ? "text-muted-foreground" : good ? "text-success" : "text-destructive",
            )}
            title="Par rapport à la période précédente de même durée, mêmes filtres"
        >
            <Icon size={12} aria-hidden />
            {stable ? "stable" : format(value)}
            <span className="sr-only"> par rapport à la période précédente</span>
        </span>
    )
}
