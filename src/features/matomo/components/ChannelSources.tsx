import { cn } from "@/shared/lib/utils"
import { SkeletonList } from "@/shared/ui/molecules/skeleton-presets"
import { useMatomoSearchEngines } from "@/features/matomo/hooks/data/useMatomo"
import type { MatomoQuery } from "@/features/matomo/services/matomoService"
import BlockError from "./BlockError"
import { fmtInt, plural } from "../utils/format"
import { topSources, type MatomoSource } from "../utils/sources"

/** Part en % : espace insécable, le « % » ne passe jamais seul à la ligne
    (il se lisait alors comme un second chiffre sous le nombre de visites). */
export const fmtShare = (share: number) => `${share.toFixed(0)}\u00a0%`

/** Barre de part. `muted` : sous-niveau, ne concurrence pas la barre du canal. */
export function ShareBar({ share, muted = false }: { share: number; muted?: boolean }) {
    return (
        <div className={cn("w-full overflow-hidden rounded-full bg-muted", muted ? "h-0.5" : "h-1")}>
            <div
                className={cn("h-full rounded-full", muted ? "bg-muted-foreground/50" : "bg-primary")}
                style={{ width: `${share}%` }}
            />
        </div>
    )
}

/** Top 5 des sources d'un canal, puis la longue traîne résumée. */
export function SourceList({ sources, channel }: { sources?: MatomoSource[]; channel: string }) {
    const { rows, others } = topSources(sources)
    if (rows.length === 0)
        return <p className="text-xs text-muted-foreground">Aucune source détaillée sur la période.</p>

    return (
        <ul className="space-y-2" aria-label={`Principales sources : ${channel}`}>
            {rows.map((s) => (
                <li key={s.label} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-3 text-xs">
                        <span className="min-w-0 truncate">{s.label}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                            {/* « du canal » : la ligne du canal, au-dessus, affiche une
                                part du total au même format. */}
                            {fmtInt(s.visits)} · {fmtShare(s.share)} du canal
                        </span>
                    </div>
                    <ShareBar share={s.share} muted />
                </li>
            ))}
            {others && (
                <li className="text-xs text-muted-foreground">
                    {plural(others.count, "autre source", "autres sources")} ·{" "}
                    {plural(others.visits, "visite")}
                </li>
            )}
        </ul>
    )
}

/** Moteurs de recherche : route dédiée du proxy, chargée au premier dépliage. */
export function SearchEngineSources({ query, channel }: { query: MatomoQuery; channel: string }) {
    const engines = useMatomoSearchEngines(query)
    if (engines.isPending) return <SkeletonList rows={3} label="Chargement des moteurs…" />
    if (engines.isError)
        return (
            <BlockError
                error={new Error("Détail des moteurs de recherche indisponible.")}
                onRetry={() => engines.refetch()}
                retrying={engines.isFetching}
            />
        )
    return <SourceList sources={engines.data} channel={channel} />
}
