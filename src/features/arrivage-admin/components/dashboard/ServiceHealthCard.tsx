import { Clock, Server } from "lucide-react"
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/shared/ui/atoms/card"
import { Skeleton } from "@/shared/ui/atoms/skeleton"
import { cn } from "@/shared/lib/utils"
import { RefreshButton } from "@/features/arrivage-admin/components/shared/RefreshButton"
import { SendAllDialog } from "@/features/arrivage-admin/components/shared/SendAllDialog"
import { WebhookPingDialog } from "@/features/arrivage-admin/components/dashboard/WebhookPingDialog"
import {
    RunStatusBadge,
    RunTriggerBadge,
} from "@/features/arrivage-admin/components/shared/RunStatusBadge"
import {
    formatDateTime,
    formatDuration,
    formatTime,
} from "@/features/arrivage-admin/utils/format"
import type { SendRun, ServiceHealth } from "@/features/arrivage-admin/types"

interface ServiceHealthCardProps {
    health: ServiceHealth
    loading: boolean
    lastRun: SendRun | null
    canSend: boolean
    sendingAll: boolean
    onRefresh: () => void
    onSendAll: () => Promise<void>
}

/** Ligne libellé / valeur, répétée dans la carte. */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span className="text-sm text-muted-foreground">{label}</span>
            <div className="flex items-center gap-2 text-sm">{children}</div>
        </div>
    )
}

export function ServiceHealthCard({
    health,
    loading,
    lastRun,
    canSend,
    sendingAll,
    onRefresh,
    onSendAll,
}: ServiceHealthCardProps) {
    const { reachable, status } = health

    const stateLabel =
        reachable === null ? "Vérification…" : reachable ? "En ligne" : "Hors ligne"

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between gap-3">
                    <CardTitle className="flex items-center gap-2">
                        <Server className="h-4 w-4" />
                        Service d'envoi
                    </CardTitle>
                    <div className="flex shrink-0 gap-2">
                        <RefreshButton
                            loading={loading}
                            onClick={onRefresh}
                            label="l'état du service"
                        />
                        {/* Diagnostic du seul segment que « Envoyer à tous »
                            ne traverse pas : c'est là, et nulle part ailleurs,
                            qu'une panne reste invisible. */}
                        <WebhookPingDialog />
                        {canSend && (
                            <SendAllDialog
                                sending={sendingAll}
                                onConfirm={onSendAll}
                            />
                        )}
                    </div>
                </div>
            </CardHeader>

            <CardContent className="divide-y divide-border">
                <Row label="Disponibilité">
                    <span
                        className={cn(
                            "h-2 w-2 rounded-full",
                            reachable === null && "bg-muted-foreground",
                            reachable === true && "bg-success",
                            reachable === false && "bg-destructive"
                        )}
                        aria-hidden
                    />
                    <span className="font-medium">{stateLabel}</span>
                </Row>

                <Row label="Prochaine diffusion">
                    {loading && reachable === null ? (
                        <Skeleton className="h-4 w-24" />
                    ) : status?.debounce === "pending" && status.fire_at ? (
                        <span className="flex items-center gap-1.5 font-medium">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            {formatTime(status.fire_at)}
                        </span>
                    ) : (
                        <span className="text-muted-foreground">
                            {/* Pas de fenêtre en cours : rien n'a été modifié
                                depuis la dernière diffusion. */}
                            Aucune en attente
                        </span>
                    )}
                </Row>

                <Row label="Dernier envoi">
                    {lastRun ? (
                        <>
                            <span>{formatDateTime(lastRun.started_at)}</span>
                            <RunTriggerBadge trigger={lastRun.trigger} />
                            <RunStatusBadge status={lastRun.status} />
                        </>
                    ) : (
                        <span className="text-muted-foreground">
                            Aucun envoi enregistré
                        </span>
                    )}
                </Row>

                {lastRun && (
                    <Row label="Détail du dernier envoi">
                        <span className="text-muted-foreground">
                            {lastRun.sent_count}/{lastRun.subscribers_total} servis
                            {" · "}
                            {formatDuration(lastRun.duration_ms)}
                        </span>
                    </Row>
                )}
            </CardContent>
        </Card>
    )
}
