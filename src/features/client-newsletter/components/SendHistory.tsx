import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { Badge } from "@/shared/ui/atoms/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/atoms/card"
import { Skeleton } from "@/shared/ui/atoms/skeleton"
import type {
    ClientNewsletterSend,
    ClientNewsletterSendStatus,
} from "@/features/client-newsletter/types"

const STATUS_BADGE: Record<
    ClientNewsletterSendStatus,
    { label: string; variant: "default" | "success" | "destructive" }
> = {
    sending: { label: "En cours", variant: "default" },
    done: { label: "Envoyé", variant: "success" },
    failed: { label: "Échec", variant: "destructive" },
}

interface SendHistoryProps {
    sends: ClientNewsletterSend[]
    loading: boolean
}

export function SendHistory({ sends, loading }: SendHistoryProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Historique des envois</CardTitle>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <Skeleton className="h-24 w-full" />
                ) : sends.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        Aucun envoi pour l'instant.
                    </p>
                ) : (
                    <div className="divide-y divide-border rounded-lg border">
                        {sends.map(s => {
                            const badge = STATUS_BADGE[s.status]
                            return (
                                <div
                                    key={s.id}
                                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                                >
                                    <div className="min-w-0">
                                        <p className="truncate font-medium">{s.subject}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {format(new Date(s.created_at), "dd/MM/yyyy HH:mm", { locale: fr })}
                                            {s.author_name ? ` · ${s.author_name}` : ""}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-muted-foreground">
                                            {s.sent_count}/{s.recipient_count} envoyés
                                            {s.failed_count > 0 ? ` · ${s.failed_count} échec${s.failed_count > 1 ? "s" : ""}` : ""}
                                        </span>
                                        <Badge variant={badge.variant} title={s.error ?? undefined}>
                                            {badge.label}
                                        </Badge>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
