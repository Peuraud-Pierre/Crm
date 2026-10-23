import { RECHARTS_TOOLTIP_THEME } from "@/shared/lib/rechartsTooltip"
import {
    Bar,
    BarChart,
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts"

import type { UseQueryResult } from "@tanstack/react-query"
import { useMemo, useRef, useState, type ReactNode } from "react"
import { Skeleton } from "@/shared/ui/atoms/skeleton"
import { TabButton, TabButtonGroup } from "@/shared/ui/molecules/tab-button-group"
import BlockError from "./BlockError"
import Panel from "./Panel"
import type { MatomoPage, MatomoTimelinePoint } from "./types"
import { fmtInt, fmtPeriodKey } from "../utils/format"

/** Corps d'un panneau graphique : squelette, erreur ou contenu, même hauteur. */
function ChartBody<T>({
    query,
    isEmpty,
    emptyText,
    children,
}: {
    query: UseQueryResult<T>
    isEmpty: (data: T) => boolean
    emptyText: string
    children: (data: T) => ReactNode
}) {
    if (query.isPending)
        return <Skeleton aria-label="Chargement du graphique…" className="h-75 w-full" />
    if (query.isError)
        return (
            <BlockError
                error={query.error}
                onRetry={() => query.refetch()}
                retrying={query.isFetching}
            />
        )
    if (isEmpty(query.data))
        return (
            <div className="flex h-75 items-center justify-center text-sm text-muted-foreground">
                {emptyText}
            </div>
        )
    return children(query.data)
}

/** Largeur (px) de la colonne de libellés : ~22 caractères à 12px, et assez
    de place pour les barres sur un téléphone de 360px. */
const PAGE_LABEL_WIDTH = 150
const truncateLabel = (label: string) =>
    label.length > 22 ? `${label.slice(0, 21)}…` : label

/** Séries de la courbe : une seule à la fois, leurs échelles diffèrent trop
    (les actions valent ~3× les visites et écrasaient les deux autres). */
const TREND_METRICS = [
    { key: "nb_visits", label: "Visites" },
    { key: "nb_uniq_visitors", label: "Visiteurs uniques" },
    { key: "nb_actions", label: "Actions" },
] as const

type TrendMetric = (typeof TREND_METRICS)[number]["key"]

function TrafficTrend({ points }: { points: MatomoTimelinePoint[] }) {
    const [metric, setMetric] = useState<TrendMetric>("nb_visits")
    const toggleRef = useRef<HTMLDivElement>(null)
    const label = TREND_METRICS.find((m) => m.key === metric)!.label

    // Résumé textuel : la courbe n'a pas d'autre alternative pour un lecteur d'écran.
    const peak = points.reduce((best, p) => (p[metric] > best[metric] ? p : best), points[0])
    const total = points.reduce((sum, p) => sum + p[metric], 0)

    return (
        <>
            <TabButtonGroup
                containerRef={toggleRef}
                className="mb-3 inline-flex gap-1 rounded-lg bg-muted/50 p-1"
                role="group"
                aria-label="Série affichée"
            >
                {TREND_METRICS.map((m) => (
                    <TabButton
                        key={m.key}
                        id={m.key}
                        label={m.label}
                        shortLabel={m.label}
                        active={metric}
                        set={(id) => setMetric(id as TrendMetric)}
                    />
                ))}
            </TabButtonGroup>
            <p className="sr-only">
                {label} : {fmtInt(total)} sur la période, au plus haut le{" "}
                {fmtPeriodKey(peak.date)} avec {fmtInt(peak[metric])}.
            </p>
            <ResponsiveContainer width="100%" height={300}>
                <LineChart data={points} margin={{ left: 0, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis
                        dataKey="date"
                        tickFormatter={fmtPeriodKey}
                        minTickGap={16}
                        stroke="hsl(var(--muted-foreground))"
                    />
                    <YAxis
                        tickFormatter={fmtInt}
                        allowDecimals={false}
                        width={48}
                        stroke="hsl(var(--muted-foreground))"
                    />
                    <Tooltip
                        {...RECHARTS_TOOLTIP_THEME}
                        labelFormatter={(key) => fmtPeriodKey(String(key))}
                        formatter={(value) => fmtInt(value)}
                    />
                    {/* Vert de marque : la seule couleur du Registre vert, et le
                        jaune --chart-5 des actions passait sous 3:1 en clair. */}
                    <Line
                        type="monotone"
                        dataKey={metric}
                        name={label}
                        stroke="hsl(var(--chart-1))"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </>
    )
}

export default function MatomoCharts({
    pages,
    timeline,
}: {
    pages: UseQueryResult<MatomoPage[]>
    timeline: UseQueryResult<MatomoTimelinePoint[]>
}) {
    const pageData = useMemo(
        () =>
            // Retrié ici : Matomo choisit le top sur les vues (filter_sort_column),
            // mais le proxy (sortRowsByVisits) le réordonne par visites, et les
            // barres de vues n'étaient plus décroissantes.
            (pages.data ?? [])
                .map((p) => ({ name: p.label || p.url || "—", value: Number(p.nb_hits || 0) }))
                .sort((a, b) => b.value - a.value)
                .slice(0, 5),
        [pages.data]
    )

    return (
        <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
            <Panel title="Évolution du trafic" busy={timeline.isPlaceholderData}>
                <ChartBody
                    query={timeline}
                    isEmpty={(points) => points.length < 2}
                    emptyText="Pas assez de données pour afficher la tendance. Choisissez une période de plusieurs jours."
                >
                    {(points) => <TrafficTrend points={points} />}
                </ChartBody>
            </Panel>

            <Panel title="Pages les plus vues" busy={pages.isPlaceholderData}>
                <ChartBody
                    query={pages}
                    isEmpty={(list) => list.length === 0}
                    emptyText="Aucune page vue sur la période."
                >
                    {() => (
                <ResponsiveContainer width="100%" height={300}>
                    {/* Barres horizontales : un titre de page ou une URL ne
                        tient pas sous une barre verticale, les libellés se
                        chevauchaient. À l'horizontale ils se lisent, tronqués,
                        et l'infobulle donne le libellé complet. */}
                    <BarChart data={pageData} layout="vertical" margin={{ left: 0, right: 8 }}>
                        <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="hsl(var(--border))"
                            horizontal={false}
                        />
                        <XAxis
                            type="number"
                            allowDecimals={false}
                            tickFormatter={fmtInt}
                            stroke="hsl(var(--muted-foreground))"
                        />
                        <YAxis
                            type="category"
                            dataKey="name"
                            width={PAGE_LABEL_WIDTH}
                            tickFormatter={truncateLabel}
                            tick={{ fontSize: 12 }}
                            stroke="hsl(var(--muted-foreground))"
                        />
                        <Tooltip
                            {...RECHARTS_TOOLTIP_THEME}
                            formatter={(value) => fmtInt(value)}
                        />
                        <Bar
                            dataKey="value"
                            name="Vues"
                            fill="hsl(var(--chart-1))"
                            radius={[0, 4, 4, 0]}
                        />
                    </BarChart>
                </ResponsiveContainer>
                    )}
                </ChartBody>
            </Panel>
        </div>
    )
}
