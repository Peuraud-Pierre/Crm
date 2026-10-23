import { useMemo, useState } from "react"
import { CheckCircle2, KeyRound, Timer, Users, XCircle } from "lucide-react"
import { StatTile } from "@/shared/components/misc/StatTile"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import {
    ARRIVAGE_ADMIN_PERMISSIONS,
    DEFAULT_STATS_DAYS,
    RECENT_RUNS_COUNT,
    STATS_PERIODS,
} from "@/features/arrivage-admin/constants"
import { AlertsBanner } from "@/features/arrivage-admin/components/dashboard/AlertsBanner"
import { RecentRunsList } from "@/features/arrivage-admin/components/dashboard/RecentRunsList"
import { SendHealthChart } from "@/features/arrivage-admin/components/dashboard/SendHealthChart"
import { ServiceHealthCard } from "@/features/arrivage-admin/components/dashboard/ServiceHealthCard"
import { useNewsletterRuns } from "@/features/arrivage-admin/hooks/data/useNewsletterRuns"
import { useNewsletterSend } from "@/features/arrivage-admin/hooks/data/useNewsletterSend"
import { useNewsletterStats } from "@/features/arrivage-admin/hooks/data/useNewsletterStats"
import { useServiceHealth } from "@/features/arrivage-admin/hooks/data/useServiceHealth"
import { buildDashboardAlerts } from "@/features/arrivage-admin/utils/alerts"
import { formatDuration, formatPercent } from "@/features/arrivage-admin/utils/format"

/** Onglet « Dashboard » — l'essentiel en un écran. */
export function DashboardTab() {
    const { hasPermission } = useAuth()
    const canSend = hasPermission(ARRIVAGE_ADMIN_PERMISSIONS.send)

    const [days, setDays] = useState<number>(DEFAULT_STATS_DAYS)

    const { stats, loading: statsLoading, error: statsError, refetch: refetchStats } =
        useNewsletterStats(days)
    const { runs, loading: runsLoading, refetch: refetchRuns } =
        useNewsletterRuns(RECENT_RUNS_COUNT, "")
    const { health, loading: healthLoading, refetch: refetchHealth } =
        useServiceHealth()
    const { sendingAll, sendToAll } = useNewsletterSend()

    const alerts = useMemo(
        () => buildDashboardAlerts(health, stats, statsError),
        [health, stats, statsError]
    )

    // Après un envoi manuel, tout l'écran est périmé : compteurs, historique
    // et fenêtre de debounce.
    const handleSendAll = async () => {
        await sendToAll()
        await Promise.all([refetchStats(), refetchRuns(), refetchHealth()])
    }

    return (
        <div className="space-y-6">
            <AlertsBanner alerts={alerts} />

            <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-medium text-muted-foreground">
                    Sur les {days} derniers jours
                </h2>
                <Select
                    value={String(days)}
                    onValueChange={v => setDays(Number(v))}
                >
                    <SelectTrigger
                        className="w-32"
                        aria-label="Période d'analyse"
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {STATS_PERIODS.map(p => (
                            <SelectItem key={p.value} value={String(p.value)}>
                                {p.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:gap-6 xl:grid-cols-5">
                <StatTile
                    icon={CheckCircle2}
                    label="Envois réussis"
                    value={stats?.sent ?? 0}
                    tone="success"
                    loading={statsLoading}
                    index={0}
                />
                <StatTile
                    icon={XCircle}
                    label="Envois en échec"
                    value={stats?.failed ?? 0}
                    tone={stats && stats.failed > 0 ? "destructive" : "primary"}
                    loading={statsLoading}
                    index={1}
                />
                <StatTile
                    icon={Timer}
                    label="Durée moyenne"
                    value={formatDuration(stats?.avg_run_duration_ms ?? null)}
                    tone="primary"
                    loading={statsLoading}
                    index={2}
                />
                <StatTile
                    icon={Users}
                    label="Abonnés actifs"
                    value={stats?.subscribers.active ?? 0}
                    tone="primary"
                    loading={statsLoading}
                    index={3}
                />
                <StatTile
                    icon={KeyRound}
                    label="Codes disponibles"
                    value={stats?.invitation_codes.available ?? 0}
                    tone={
                        stats && stats.invitation_codes.available === 0
                            ? "warning"
                            : "primary"
                    }
                    loading={statsLoading}
                    index={4}
                />
            </div>

            <ServiceHealthCard
                health={health}
                loading={healthLoading}
                lastRun={stats?.last_run ?? null}
                canSend={canSend}
                sendingAll={sendingAll}
                onRefresh={refetchHealth}
                onSendAll={handleSendAll}
            />

            {/* min-w-0 sur les enfants : sans ça, un ResponsiveContainer
                empêche la colonne de grille de rétrécir. */}
            <div className="grid gap-4 sm:gap-6 lg:grid-cols-2 [&>*]:min-w-0">
                <SendHealthChart
                    daily={stats?.daily ?? []}
                    loading={statsLoading}
                />
                <RecentRunsList runs={runs} loading={runsLoading} />
            </div>

            {stats && stats.sent + stats.failed > 0 && (
                <p className="text-xs text-muted-foreground">
                    Taux d'échec sur la période :{" "}
                    {formatPercent(stats.failure_rate)} · {stats.runs_total}{" "}
                    diffusion(s), dont {stats.runs_failed} en anomalie.
                </p>
            )}
        </div>
    )
}
