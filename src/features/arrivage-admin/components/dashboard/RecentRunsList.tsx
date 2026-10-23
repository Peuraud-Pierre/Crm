import { History } from "lucide-react"
import { motion } from "framer-motion"
import { usePrefersReducedMotion } from "@/shared/hooks/usePrefersReducedMotion"
import { useNavigate } from "react-router"
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/shared/ui/atoms/card"
import { Skeleton } from "@/shared/ui/atoms/skeleton"
import { BASE_PATH } from "@/features/arrivage-admin/constants"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import {
    RunStatusBadge,
    RunTriggerBadge,
} from "@/features/arrivage-admin/components/shared/RunStatusBadge"
import { formatDateTime, formatDuration } from "@/features/arrivage-admin/utils/format"
import type { SendRun } from "@/features/arrivage-admin/types"

const SKELETON_ROWS = ["rr1", "rr2", "rr3"]

interface RecentRunsListProps {
    runs: SendRun[]
    loading: boolean
}

/**
 * Aperçu des derniers envois. Chaque ligne ouvre le détail de l'envoi dans
 * l'onglet Logs, en push — le bouton retour ramène au dashboard.
 */
export function RecentRunsList({ runs, loading }: RecentRunsListProps) {
    const navigate = useNavigate()
    const reducedMotion = usePrefersReducedMotion()

    const open = (run: SendRun) => navigate(`${BASE_PATH}/logs/${run.id}`)

    return (
        <Card className="min-w-0">
            <CardHeader>
                <CardTitle>Derniers envois</CardTitle>
            </CardHeader>
            <CardContent className="p-0" aria-busy={loading}>
                {loading ? (
                    <div className="space-y-3 p-4">
                        {SKELETON_ROWS.map(key => (
                            <Skeleton key={key} className="h-14 w-full rounded-lg" />
                        ))}
                    </div>
                ) : runs.length === 0 ? (
                    <EmptyState
                        icon={History}
                        title="Aucun envoi enregistré"
                        description="L'historique se remplit dès la première diffusion."
                    />
                ) : (
                    <ul className="divide-y divide-border">
                        {runs.map((run, index) => (
                            <motion.li
                                key={run.id}
                                initial={
                                    reducedMotion ? false : { opacity: 0, y: 6 }
                                }
                                animate={{ opacity: 1, y: 0 }}
                                transition={{
                                    duration: 0.25,
                                    delay: index * 0.04,
                                }}
                            >
                                <button
                                    type="button"
                                    onClick={() => open(run)}
                                    className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-muted/50 sm:px-6"
                                >
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium">
                                            {formatDateTime(run.started_at)}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {run.sent_count}/
                                            {run.subscribers_total} servis ·{" "}
                                            {formatDuration(run.duration_ms)}
                                        </p>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-2">
                                        <RunTriggerBadge trigger={run.trigger} />
                                        <RunStatusBadge status={run.status} />
                                    </div>
                                </button>
                            </motion.li>
                        ))}
                    </ul>
                )}
            </CardContent>
        </Card>
    )
}
