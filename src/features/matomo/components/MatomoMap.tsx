import {
    countryVisits,
    type MatomoCountry,
    type RankedCountry,
} from "@/features/matomo/components/types"
import { SkeletonText } from "@/shared/ui/molecules/skeleton-presets"
import type { UseQueryResult } from "@tanstack/react-query"
import BlockError from "./BlockError"
import { Button } from "@/shared/ui/atoms/button"
import { Skeleton } from "@/shared/ui/atoms/skeleton"
import MatomoCountryRanking from "./MatomoCountryRanking"
import { useCountriesGeoJson } from "@/features/matomo/hooks/data/useMatomo"
import { cn } from "@/shared/lib/utils"
import { plural } from "../utils/format"
import type { StyleSpecification } from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import "@/shared/lib/maplibreWorker"
import {
    useCallback,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore,
} from "react"
import MapView, { Layer, Source } from "react-map-gl/maplibre"


/* MapLibre peint en WebGL et ne résout pas `var(--token)` (design system
   §12.4). Plutôt que de figer des couleurs littérales, on lit les tokens HSL
   (« 131 65% 32% ») sur <html> au rendu : la carte reste dans la palette du
   Registre vert, clair, sombre et bio-mode compris. Relu à chaque changement
   de classe sur <html> (`.dark`, `.bio-mode`), source réelle des tokens. */
type Hsl = [number, number, number]

function readToken(name: string): Hsl {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(
        `--${name}`
    )
    const [h = 0, s = 0, l = 0] = raw.trim().split(/\s+/).map(parseFloat)
    return [h, s, l]
}

const toCss = ([h, s, l]: Hsl, alpha = 1) =>
    `hsla(${h}, ${s}%, ${l}%, ${alpha})`

const mixHsl = (a: Hsl, b: Hsl, t: number): Hsl =>
    [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t) as Hsl

function subscribeRootClass(onChange: () => void) {
    const observer = new MutationObserver(onChange)
    observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
    })
    return () => observer.disconnect()
}

const getRootClass = () => document.documentElement.className

/** Emprise habitée [ouest-sud, est-nord] : sans l'Antarctique ni le Grand Nord vide. */
const WORLD_BOUNDS: [[number, number], [number, number]] = [
    [-168, -56],
    [180, 78],
]

/* Plancher de la rampe : sans lui, un pays à 1 visite prendrait
   --brand-light, quasi confondu avec la surface « sans donnée ». */
const RAMP_FLOOR = 0.15

export default function MatomoMap({
    countries,
}: {
    countries: UseQueryResult<MatomoCountry[]>
}) {
    const rootClass = useSyncExternalStore(subscribeRootClass, getRootClass)
    const geo = useCountriesGeoJson()
    const geoJson = geo.data ?? null
    const [hovered, setHovered] = useState<{
        name: string
        visitors: number
    } | null>(null)
    const lastHoverKeyRef = useRef<string | null>(null)
    const hoverRafRef = useRef<number | null>(null)
    const hoverNextRef = useRef<{ name: string; visitors: number } | null>(null)

    const stableCountries = useMemo(() => countries.data ?? [], [countries.data])

    const rankedCountries = useMemo(
        () =>
            stableCountries
                .map((c): RankedCountry => ({ ...c, visits: countryVisits(c) }))
                .sort((a, b) => b.visits - a.visits),
        [stableCountries]
    )
    const totalVisitors = rankedCountries.reduce(
        (sum, c) => sum + c.visits,
        0
    )

    const countryIndex = useMemo(() => {
        const byCode = new Map<string, MatomoCountry>()
        for (const country of stableCountries) {
            const code = country?.code?.toLowerCase()
            if (code) byCode.set(code, country)
        }
        return { byCode }
    }, [stableCountries])

    // Le fond de carte (public/geo) ne porte que ISO_A2 et NAME : jointure par
    // code pays seul, les noms Matomo (anglais) et GeoJSON (français) diffèrent.
    const getCountryData = useCallback(
        (props: Record<string, unknown>) =>
            props?.ISO_A2
                ? countryIndex.byCode.get(String(props.ISO_A2).toLowerCase())
                : undefined,
        [countryIndex]
    )

    const maxVisitors = useMemo(() => {
        return stableCountries.reduce(
            (max, c) => Math.max(max, countryVisits(c)),
            0
        )
    }, [stableCountries])

    // `rootClass` n'est lu que pour invalider : les tokens changent avec les
    // classes posées sur <html>, que ce memo relit.
    const palette = useMemo(() => {
        void rootClass
        return {
            surface: readToken("card"),
            border: readToken("border"),
            empty: readToken("muted"),
            low: readToken("brand-light"),
            high: readToken("brand"),
        }
    }, [rootClass])

    const baseStyle = useMemo(
        () =>
            ({
                version: 8,
                sources: {},
                layers: [
                    {
                        id: "background",
                        type: "background",
                        paint: {
                            "background-color": toCss(palette.surface),
                        },
                    },
                ],
            }) as StyleSpecification,
        [palette]
    )

    const enrichedGeoJson = useMemo(() => {
        if (!geoJson?.features) return null

        return {
            ...geoJson,
            features: geoJson.features.map((feature: GeoJSON.Feature) => {
                const countryData = getCountryData(
                    (feature?.properties as Record<string, unknown>) || {}
                )
                const visitors = countryVisits(countryData)
                const normalized = maxVisitors
                    ? Math.log10(visitors + 1) / Math.log10(maxVisitors + 1)
                    : 0
                const fill = visitors
                    ? toCss(
                          mixHsl(
                              palette.low,
                              palette.high,
                              RAMP_FLOOR + normalized * (1 - RAMP_FLOOR)
                          )
                      )
                    : toCss(palette.empty)

                return {
                    ...feature,
                    properties: {
                        ...feature.properties,
                        __visitors: visitors,
                        __fill: fill,
                        __name:
                            (feature?.properties as Record<string, unknown>)?.NAME ||
                            "Pays",
                    },
                }
            }),
        }
    }, [geoJson, countryIndex, maxVisitors, palette, getCountryData])

    const scheduleHover = (next: { name: string; visitors: number } | null) => {
        hoverNextRef.current = next
        if (hoverRafRef.current !== null) return
        hoverRafRef.current = requestAnimationFrame(() => {
            hoverRafRef.current = null
            const value = hoverNextRef.current
            hoverNextRef.current = null
            if (!value) {
                if (lastHoverKeyRef.current !== null) {
                    lastHoverKeyRef.current = null
                    setHovered(null)
                }
                return
            }

            const key = `${value.name}:${value.visitors}`
            if (lastHoverKeyRef.current === key) return
            lastHoverKeyRef.current = key
            setHovered(value)
        })
    }

    return (
        <div className="flex flex-col gap-4 sm:gap-6 lg:flex-row lg:items-stretch">
            {/* Même atténuement que Panel pendant le rechargement d'un filtre. */}
            <div
                aria-busy={countries.isPlaceholderData}
                className={cn(
                    "relative w-full overflow-hidden rounded-lg border bg-card p-4 shadow-sm transition-opacity duration-base lg:min-w-0 lg:flex-1",
                    countries.isPlaceholderData && "opacity-60"
                )}
            >
                <h2 className="mb-4 text-sm font-medium text-foreground">
                    Visites par pays
                </h2>
                {/* 16/9 = ratio de WORLD_BOUNDS en Web Mercator (1,77) : le
                    cadrage remplit le panneau sans bandes vides. Remplace une
                    valeur arbitraire (225/190) calée sur l'ancien zoom fixe. */}
                <div className="relative w-full aspect-video">
                    {/* Squelette jusqu'aux contours ET aux pays : avec les seuls
                        contours, la carte s'affichait toute grise un instant,
                        comme si personne n'était venu. */}
                    {(geo.isPending || countries.isPending) && (
                        <Skeleton
                            aria-label="Chargement de la carte…"
                            className="absolute inset-0 z-10 rounded-md"
                        />
                    )}
                    {/* Si le fond de carte manque, on le dit au lieu de laisser
                        un cadre vide. */}
                    {geo.isError && (
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 p-4 text-center text-sm text-muted-foreground">
                            <p>Fond de carte indisponible. Le classement des pays reste juste.</p>
                            <Button size="sm" variant="outline" onClick={() => geo.refetch()} loading={geo.isFetching}>
                                Réessayer
                            </Button>
                        </div>
                    )}
                    <MapView
                        mapStyle={baseStyle as StyleSpecification}
                        // Cadrage sur l'emprise habitée, recalculé à chaque
                        // redimensionnement : au zoom 2 fixe, le monde faisait
                        // 2 048 px de large (512 × 2²) et seule l'Europe tenait
                        // dans le panneau, sur mobile comme sur desktop.
                        initialViewState={{ bounds: WORLD_BOUNDS }}
                        onResize={(e) => e.target.fitBounds(WORLD_BOUNDS, { animate: false })}
                        minZoom={0}
                        maxZoom={4}
                        attributionControl={false}
                        dragPan={false}
                        dragRotate={false}
                        scrollZoom={false}
                        doubleClickZoom={false}
                        keyboard={false}
                        touchZoomRotate={false}
                        interactiveLayerIds={["countries-fill"]}
                        onMouseMove={(event) => {
                            const feature = event.features?.[0]
                            if (!feature) {
                                return scheduleHover(null)
                            }

                            const name = feature.properties?.__name || "Pays"
                            const visitors =
                                Number(feature.properties?.__visitors) || 0

                            scheduleHover({ name, visitors })
                        }}
                        onMouseLeave={() => {
                            scheduleHover(null)
                        }}
                        cursor={hovered ? "pointer" : "default"}
                        style={{ width: "100%", height: "100%" }}
                    >
                        {enrichedGeoJson && (
                            <Source
                                id="countries"
                                type="geojson"
                                data={enrichedGeoJson}
                            >
                                <Layer
                                    id="countries-fill"
                                    type="fill"
                                    paint={{
                                        "fill-color": ["get", "__fill"],
                                        "fill-outline-color": toCss(
                                            palette.border
                                        ),
                                        "fill-opacity": 1,
                                    }}
                                />
                                <Layer
                                    id="countries-outline"
                                    type="line"
                                    paint={{
                                        "line-color": toCss(palette.border),
                                        "line-width": 0.7,
                                    }}
                                />
                            </Source>
                        )}
                    </MapView>

                    {hovered && (
                        <div className="absolute left-3 bottom-3 z-50 rounded-md border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
                            <div className="font-semibold">{hovered.name}</div>
                            <div className="text-muted-foreground">
                                {plural(hovered.visitors, "visite")}
                            </div>
                        </div>
                    )}
                </div>

                {/* Légende : mêmes bornes que la rampe de la carte. Masquée
                    sans donnée, où « 1 → 0 visite » ne voudrait rien dire. */}
                {maxVisitors > 0 && (
                <div className="mt-4 flex flex-col items-center gap-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                        <span className="tabular-nums">1</span>
                        <div
                            aria-hidden
                            className="h-2 w-40 rounded-full bg-linear-to-r from-brand-light to-brand"
                        />
                        <span className="tabular-nums">
                            {plural(maxVisitors, "visite")}
                        </span>
                    </div>
                    {/* La rampe est logarithmique (log10) : sans le dire, on lirait
                        le milieu de la légende comme la moitié du maximum. */}
                    <p>Échelle logarithmique : les pays peu visités restent visibles.</p>
                </div>
                )}

                {countries.isPending ? (
                    <SkeletonText lines={1} label="Chargement des visites par pays…" className="mt-2" />
                ) : countries.isError ? (
                    <div className="mt-3">
                        <BlockError
                            error={countries.error}
                            onRetry={() => countries.refetch()}
                            retrying={countries.isFetching}
                        />
                    </div>
                ) : (
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                        {plural(totalVisitors, "visite localisée", "visites localisées")}
                    </p>
                )}
            </div>
            <MatomoCountryRanking countries={countries} ranked={rankedCountries} />
        </div>
    )
}
