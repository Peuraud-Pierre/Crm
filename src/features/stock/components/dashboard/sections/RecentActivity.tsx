import { useNavigate } from "react-router"
import { Clock, HistoryIcon, ArrowRight } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { Skeleton } from "@/shared/ui/atoms/skeleton"
import { Button } from "@/shared/ui/atoms/button"
import { useHistoryContext } from "@/features/stock/hooks/context/StockProvider"
import { GESTION_THEME } from "@/features/stock/theme"
import { ACTIVITY_MAX_ITEMS } from "@/features/stock/constants"
import {
    timeAgo,
    ENTITY_ICON,
    ENTITY_LABEL,
    ACTION_ICON,
    ACTION_COLORS,
    ACTION_LABEL,
    ENTITY_COLORS,
} from "../../../utils/activityHelpers"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import { SkeletonGroup } from "@/shared/ui/molecules/skeleton-presets"
import { STOCK_ROUTE_BASE } from "@/features/stock/types/ui.types"

export function RecentActivitySection() {
    const { activityLogs, loading } = useHistoryContext()
    const navigate = useNavigate()

    const recent = activityLogs.slice(0, ACTIVITY_MAX_ITEMS)

    return (
        <div>
            <div className="flex items-center justify-between mb-3">
                <h2 className={GESTION_THEME.section.groupTitle}>Activité récente</h2>
                <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 h-7 px-2"
                    onClick={() => navigate(`${STOCK_ROUTE_BASE}/historique`)}
                >
                    Voir tout
                    <ArrowRight size={12} />
                </Button>
            </div>

            <div className={cn(GESTION_THEME.filterBar.container, "overflow-hidden")}>
                {loading ? (
                    <SkeletonGroup
                        className="flex flex-col gap-0"
                        label="Chargement de l'activité récente…"
                    >
                        {Array.from({ length: 4 }, (_, i) => `recent-skeleton-${i}`).map((key) => (
                            <div key={key} className="flex items-center gap-3 px-4 py-3">
                                <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
                                <div className="flex-1 space-y-1.5">
                                    <Skeleton className="h-3 w-full max-w-[180px]" />
                                    <Skeleton className="h-2.5 w-full max-w-[120px]" />
                                </div>
                                <Skeleton className="h-2.5 w-8 shrink-0" />
                            </div>
                        ))}
                    </SkeletonGroup>
                ) : recent.length === 0 ? (
                    <EmptyState
                        size="sm"
                        icon={HistoryIcon}
                        title="Aucune activité enregistrée"
                    />
                ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-52 sm:max-h-80 lg:max-h-[540px] overflow-y-auto">
                        {recent.map((log) => (
                            <div
                                key={log.id}
                                className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                            >
                                {/* Entity icon */}
                                <div
                                    className={cn(
                                        "p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0",
                                        ENTITY_COLORS[log.entity_type]
                                    )}
                                >
                                    {ENTITY_ICON[log.entity_type]}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1 flex-wrap">
                                        <span
                                            className={cn(
                                                "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-3xs font-bold",
                                                ACTION_COLORS[log.action]
                                            )}
                                        >
                                            {ACTION_ICON[log.action]}
                                            {ACTION_LABEL[log.action]}
                                        </span>
                                        <span className="text-3xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                                            {ENTITY_LABEL[log.entity_type]}
                                        </span>
                                        {log.entity_label && (
                                            <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-200 truncate max-w-[80px]">
                                                {log.entity_label}
                                            </span>
                                        )}
                                    </div>
                                    {log.description && (
                                        <p className="text-2xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                                            {log.description}
                                        </p>
                                    )}
                                </div>

                                {/* Timestamp */}
                                <div className="flex items-center gap-1 shrink-0 text-slate-400 dark:text-slate-500">
                                    <Clock size={10} />
                                    <span className="text-3xs font-medium tabular-nums">
                                        {timeAgo(log.created_at)}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
