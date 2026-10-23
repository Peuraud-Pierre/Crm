import { Send } from "lucide-react"
import { motion } from "framer-motion"
import { Button } from "@/shared/ui/atoms/button"
import { Card } from "@/shared/ui/atoms/card"
import { Switch } from "@/shared/ui/atoms/switch"
import { formatDate } from "@/features/arrivage-admin/utils/format"
import type { Subscriber } from "@/features/arrivage-admin/types"

interface SubscriberCardProps {
    subscriber: Subscriber
    canSend: boolean
    sending: boolean
    disabled: boolean
    /** Position dans la liste — pilote le décalage de l'animation d'entrée. */
    index: number
    /** Reçu du parent : un seul abonnement au media query pour toute la liste. */
    reducedMotion: boolean
    onResend: (userId: string) => void
    onToggleArrivage: (userId: string, arrivage: boolean) => void
    onToggleCrmStat: (userId: string, crmStat: boolean) => void
}

/** Vue mobile d'un abonné (< md) — équivalent d'une ligne de `SubscriberTable`. */
export function SubscriberCard({
    subscriber,
    canSend,
    sending,
    disabled,
    index,
    reducedMotion,
    onResend,
    onToggleArrivage,
    onToggleCrmStat,
}: SubscriberCardProps) {
    const columnCount = Array.isArray(subscriber.visible_columns)
        ? subscriber.visible_columns.length
        : 0

    return (
        <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: Math.min(index, 8) * 0.04 }}
        >
            <Card variant="elevated" className="space-y-3 p-4">
                <p className="min-w-0 truncate text-sm font-medium">
                    {subscriber.email}
                </p>

                <div className="space-y-0.5 text-sm text-muted-foreground">
                    <p className="truncate">{subscriber.full_name || "—"}</p>
                    <p>
                        {columnCount} colonne(s) · depuis{" "}
                        {formatDate(subscriber.created_at)}
                    </p>
                </div>

                <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-muted-foreground">
                        Newsletter arrivage
                    </span>
                    <Switch
                        checked={!!subscriber.arrivage}
                        onCheckedChange={checked =>
                            onToggleArrivage(subscriber.user_id, checked)
                        }
                        aria-label={`Newsletter arrivage pour ${subscriber.email}`}
                    />
                </div>

                <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-muted-foreground">
                        Newsletter stats CRM
                    </span>
                    <Switch
                        checked={!!subscriber.crm_stat}
                        onCheckedChange={checked =>
                            onToggleCrmStat(subscriber.user_id, checked)
                        }
                        aria-label={`Newsletter stats CRM pour ${subscriber.email}`}
                    />
                </div>

                {canSend && (
                    <div className="flex justify-end">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onResend(subscriber.user_id)}
                            disabled={!subscriber.active || sending || disabled}
                        >
                            <Send className="mr-1 h-3.5 w-3.5" />
                            {sending ? "Envoi…" : "Renvoyer"}
                        </Button>
                    </div>
                )}
            </Card>
        </motion.div>
    )
}
