import type { UseQueryResult } from "@tanstack/react-query"
import { flagUrl } from "@/features/matomo/services/matomoService"
import { cn } from "@/shared/lib/utils"
import { SkeletonList } from "@/shared/ui/molecules/skeleton-presets"
import type { MatomoCountry, RankedCountry } from "./types"
import { fmtInt } from "../utils/format"

/**
 * Classement des pays, à côté de la carte (dessous sous lg). C'est aussi
 * l'alternative accessible à la carte, qui ne se lit qu'au survol.
 */
export default function MatomoCountryRanking({
    countries,
    ranked,
}: {
    countries: UseQueryResult<MatomoCountry[]>
    /** Pays triés par visites décroissantes. */
    ranked: RankedCountry[]
}) {
    return (
        <div
            aria-busy={countries.isPlaceholderData}
            className={cn(
                "relative w-full overflow-hidden rounded-lg border bg-card shadow-sm transition-opacity duration-base lg:w-72 lg:shrink-0",
                countries.isPlaceholderData && "opacity-60"
            )}
        >
            {/* Sous lg, le classement passe sous la carte : plafonné en
                hauteur, il ne repousse pas les canaux d'un écran entier
                (tous les pays visités y figurent, sans limite). */}
            <div className="max-h-80 overflow-auto p-4 lg:absolute lg:inset-0 lg:max-h-none w-full h-full">
                <h2 className="mb-4 text-sm font-medium text-foreground">
                    Classement des pays
                </h2>
                {countries.isPending && (
                    <SkeletonList rows={6} label="Chargement du classement…" />
                )}
                {countries.isSuccess && ranked.length === 0 && (
                    <p className="px-2 text-sm text-muted-foreground">
                        Aucune visite localisée sur la période.
                    </p>
                )}
                <ul>
                    {ranked.map((v) => (
                        <li
                            key={
                                v.code || `${v.label}-${v.visits}`
                            }
                            className="flex items-center justify-between gap-2 px-2 py-1.5"
                        >
                            <div className="flex min-w-0 items-center gap-2">
                                {v.code && (
                                    <img
                                        src={flagUrl(
                                            `plugins/Morpheus/icons/dist/flags/${v.code}.png`
                                        )}
                                        alt=""
                                        className="w-5 h-4 shrink-0"
                                    />
                                )}
                                <span className="truncate text-sm">
                                    {v.label}
                                </span>
                            </div>

                            <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                                {fmtInt(v.visits)}
                            </span>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    )
}
