import { useMemo } from "react"
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { RECHARTS_TOOLTIP_THEME } from "@/shared/lib/rechartsTooltip"
import { GESTION_THEME } from "@/features/stock"
import { useTriContext } from "@/features/salle-de-tri/hooks/context/TriContext"
import { formatKg, type TriAnalytics } from "@/features/salle-de-tri/utils/triAnalytics"
import { useSortieColor } from "./RepartitionBar"

const AXIS = { stroke: GESTION_THEME.chart.axis, fontSize: 12, tickLine: false, axisLine: false } as const
const kgTick = (v: number) => (v >= 1000 ? `${Math.round(v / 100) / 10} t` : `${v}`)

/**
 * Kilos triés par semaine, empilés par type de sortie. Une seule échelle
 * (les kilos) ; la couleur d'un type est celle du référentiel, identique
 * dans la fiche, le tableau et ce graphique.
 */
export function KgParSemaineChart({ data, mode = "kg" }: { data: TriAnalytics["parSemaine"]; mode?: "kg" | "pct" }) {
    const { sorties } = useTriContext()
    const color = useSortieColor()
    // Seules les sorties présentes dans la période : une légende de séries
    // vides ne dit rien.
    const presentes = useMemo(
        () => sorties.filter((s) => data.some((w) => typeof w[s.id] === "number")),
        [sorties, data],
    )
    const rows = useMemo(() => data.map((w) => ({ ...w, label: w.semaine.replace(/^\d{4}-W/, "S") })), [data])

    return (
        <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
                {/* En %, chaque semaine remplit la hauteur : on lit la part de chaque type. */}
                <BarChart data={rows} margin={{ left: 0, right: 8, top: 8 }} stackOffset={mode === "pct" ? "expand" : undefined}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GESTION_THEME.chart.grid} vertical={false} />
                    <XAxis dataKey="label" {...AXIS} />
                    <YAxis {...AXIS} width={44} tickFormatter={mode === "pct" ? (v: number) => `${Math.round(v * 100)} %` : kgTick} />
                    <Tooltip
                        {...RECHARTS_TOOLTIP_THEME}
                        cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                        labelFormatter={(_, payload) => {
                            const week = payload?.[0]?.payload?.semaine as string | undefined
                            return week ? `Semaine ${week.slice(6)} · ${week.slice(0, 4)}` : ""
                        }}
                        formatter={(value, name) => [formatKg(Number(value)), String(name)]}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
                    {presentes.map((s, i) => (
                        <Bar
                            key={s.id}
                            dataKey={s.id}
                            name={s.code}
                            stackId="kg"
                            fill={color(s.id)}
                            maxBarSize={36}
                            // Seul le haut de la pile est arrondi ; un liseré de la
                            // couleur de fond sépare les segments.
                            radius={i === presentes.length - 1 ? [4, 4, 0, 0] : 0}
                            stroke="hsl(var(--card))"
                            strokeWidth={1}
                        />
                    ))}
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}

/** Kilos par trieur, barres horizontales — la productivité est dans le tableau voisin, pas sur un second axe. */
export function KgParTrieurChart({ data }: { data: { nom: string; kg: number }[] }) {
    // L'axe des noms s'ajuste au plus long, dans une limite raisonnable.
    const axisWidth = Math.min(140, Math.max(56, ...data.map((d) => d.nom.length * 7 + 8)))
    return (
        <div className="w-full" style={{ height: Math.max(160, data.length * 36 + 40) }}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GESTION_THEME.chart.grid} horizontal={false} />
                    <XAxis type="number" {...AXIS} tickFormatter={kgTick} />
                    <YAxis type="category" dataKey="nom" {...AXIS} width={axisWidth} />
                    <Tooltip
                        {...RECHARTS_TOOLTIP_THEME}
                        cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                        formatter={(value) => [formatKg(Number(value)), "Trié"]}
                    />
                    {/* Une seule série : pas de légende, le titre de la carte la nomme. */}
                    <Bar dataKey="kg" fill={GESTION_THEME.chart.palette[0]} radius={[0, 4, 4, 0]} maxBarSize={20} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}
