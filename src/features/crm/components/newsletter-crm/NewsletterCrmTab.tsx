import {
    DailySendCountdown,
    WeeklySendCountdown,
} from "./NewsletterSendCountdown"
import { Card, CardContent } from "@/shared/ui/atoms/card"

interface SendLogEntry {
    week: number
    sentAt: string
}

/** Données factices — maquette visuelle, en attendant le câblage à une source réelle. */
const SEND_LOGS: SendLogEntry[] = [
    { week: 34, sentAt: "21/08/2026" },
    { week: 33, sentAt: "14/08/2026" },
    { week: 32, sentAt: "07/08/2026" },
]

const SEND_COUNT = SEND_LOGS.length
const LAST_SENT_AT = SEND_LOGS[0]?.sentAt ?? "—"
const RECIPIENT_COUNT = 214

/**
 * Onglet « Newsletter CRM » — maquette réduite : deux compteurs, les deux
 * créneaux d'envoi automatique (lundi 8h pour la semaine précédente, tous
 * les soirs 19h pour la stat du jour — chacun avec son propre bouton de
 * test) et le journal des envois. Aucune donnée réelle câblée pour
 * l'instant (SEND_LOGS / RECIPIENT_COUNT).
 */
export function NewsletterCrmTab() {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
                <Card variant="elevated">
                    <CardContent className="pt-6">
                        <p className="text-2xl font-semibold">{SEND_COUNT}</p>
                        <p className="text-xs text-muted-foreground">
                            Envois · dernier le {LAST_SENT_AT}
                        </p>
                    </CardContent>
                </Card>
                <Card variant="elevated">
                    <CardContent className="pt-6">
                        <p className="text-2xl font-semibold">
                            {RECIPIENT_COUNT}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Destinataires
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <WeeklySendCountdown />
                <DailySendCountdown />
            </div>

            <div className="divide-y divide-border rounded-lg border">
                {SEND_LOGS.map(entry => (
                    <div
                        key={entry.week}
                        className="flex items-center justify-between px-4 py-3 text-sm"
                    >
                        <span>Semaine {entry.week}</span>
                        <span className="text-muted-foreground">
                            envoyé le {entry.sentAt}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    )
}
