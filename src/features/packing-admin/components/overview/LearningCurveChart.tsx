import {
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts"
import { LineChart as LineChartIcon } from "lucide-react"
import { Card } from "@/shared/ui/atoms/card"
import { Skeleton } from "@/shared/ui/atoms/skeleton"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import { RECHARTS_TOOLTIP_THEME } from "@/shared/lib/rechartsTooltip"
import { MIN_CURVE_POINTS } from "@/features/packing-admin/constants"
import { formatShare } from "@/features/packing-admin/utils/format"
import type { PackingReplayReport } from "@/features/packing-admin/types"

interface LearningCurveChartProps {
    replay: PackingReplayReport | null
    loading: boolean
}

/** Les séries sont déjà en pourcentage : le tooltip n'ajoute que l'unité. */
function formatTooltipValue(value: unknown): string {
    return typeof value === "number" ? `${value} %` : "—"
}

/**
 * La courbe de la promesse : la part des lignes que PERSONNE n'a eu à trancher,
 * conteneur après conteneur.
 *
 * Deux choix de fond.
 *
 * **La source est le rejeu, pas `classifier_meta`.** Ce dernier consigne ce que
 * le moteur a réellement fait au moment de chaque import, donc mélange plusieurs
 * états successifs du modèle et du code : tracé tel quel, il parlerait autant des
 * versions livrées que de l'apprentissage. Le rejeu recalcule un contrefactuel
 * cohérent avec les réglages d'aujourd'hui.
 *
 * **Sous trois conteneurs, on ne trace RIEN.** Une droite à deux points se lit
 * comme une tendance sans en être une, et c'est précisément le chiffre sur lequel
 * on juge la feature : il ne doit pas être flatté. On affiche alors les valeurs
 * brutes et on dit qu'il est trop tôt.
 */
export function LearningCurveChart({ replay, loading }: LearningCurveChartProps) {
    if (loading) return <Skeleton className="h-64 w-full rounded-lg" />

    const steps = replay?.steps ?? []
    if (steps.length === 0) {
        return (
            <Card className="p-4 sm:p-6">
                <EmptyState
                    size="sm"
                    icon={LineChartIcon}
                    title="Aucune packing list validée"
                    description="La courbe se construit à partir des conteneurs validés : elle apparaîtra dès le premier."
                />
            </Card>
        )
    }

    const total = replay?.total_packings ?? steps.length

    if (steps.length < MIN_CURVE_POINTS) {
        return (
            <Card className="flex flex-col gap-3 p-4 sm:p-6">
                <h3 className="text-sm font-semibold text-foreground">Classées sans intervention</h3>
                <ul className="flex flex-col gap-2">
                    {steps.map((step) => (
                        <li
                            key={step.packing_list_id}
                            className="flex flex-col gap-1 text-xs sm:flex-row sm:items-center sm:gap-3"
                        >
                            <span className="w-full truncate text-foreground sm:w-40 sm:shrink-0">
                                {step.container_label ?? step.label}
                            </span>
                            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                                <span
                                    className="block h-full rounded-full bg-success"
                                    // Largeur calculée : aucune classe utilitaire ne l'exprime.
                                    style={{ width: `${Math.round(step.untouched_share * 100)}%` }}
                                />
                            </span>
                            <span className="w-full tabular-nums text-muted-foreground sm:w-24 sm:shrink-0 sm:text-right">
                                {formatShare(step.untouched_share)}
                            </span>
                        </li>
                    ))}
                </ul>
                <p className="text-xs text-muted-foreground">
                    Il faut {MIN_CURVE_POINTS} conteneurs validés pour qu'une tendance veuille dire
                    quelque chose ({total} à ce jour). Les chiffres ci-dessus sont justes, ils ne
                    dessinent simplement pas encore de courbe.
                </p>
            </Card>
        )
    }

    const data = steps.map((step, index) => ({
        index: index + 1,
        label: step.container_label ?? step.label,
        untouched: Math.round(step.untouched_share * 1000) / 10,
        toReview: step.lines > 0 ? Math.round((step.to_review / step.lines) * 1000) / 10 : 0,
    }))

    return (
        <Card className="flex flex-col gap-3 p-4 sm:p-6">
            <div className="flex flex-col gap-1">
                <h3 className="text-sm font-semibold text-foreground">Courbe d'apprentissage</h3>
                <p className="text-xs text-muted-foreground">
                    Part des lignes que personne n'a eu à trancher, conteneur après conteneur.
                    {replay?.simulated && " Réglages simulés, pas ceux de la production."}
                </p>
            </div>

            {/* h-64 fixe + min-w-0 sur la cellule parente : sans ça un
                ResponsiveContainer empêche la colonne de grille de rétrécir. */}
            <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                        <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                        <XAxis
                            dataKey="label"
                            stroke="hsl(var(--muted-foreground))"
                            tickLine={false}
                            axisLine={false}
                            fontSize={11}
                        />
                        <YAxis
                            domain={[0, 100]}
                            unit="%"
                            stroke="hsl(var(--muted-foreground))"
                            tickLine={false}
                            axisLine={false}
                            fontSize={11}
                        />
                        {/* Thème partagé : les couleurs du tooltip viennent des
                            tokens `--popover`, pas d'un style local. */}
                        <Tooltip {...RECHARTS_TOOLTIP_THEME} formatter={formatTooltipValue} />
                        <Legend iconSize={8} wrapperStyle={{ fontSize: "0.6875rem" }} />
                        <Line
                            type="monotone"
                            dataKey="untouched"
                            name="Sans intervention"
                            stroke="hsl(var(--success))"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                        />
                        <Line
                            type="monotone"
                            dataKey="toReview"
                            name="À revoir"
                            stroke="hsl(var(--warning))"
                            strokeWidth={2}
                            strokeDasharray="4 3"
                            dot={{ r: 3 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            {total > steps.length && (
                <p className="text-2xs text-muted-foreground">
                    {steps.length} premiers conteneurs sur {total}. Le rejeu part du début de
                    l'histoire : tronquer les premiers fausserait la courbe.
                </p>
            )}
        </Card>
    )
}
