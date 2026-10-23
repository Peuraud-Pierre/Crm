import { useEffect, useState } from "react"
import { Clock, Moon } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/atoms/card"
import { AnalyticsProvider } from "@/features/crm/context/AnalyticsContext"
import { SendTestNewsletterButton } from "./SendTestNewsletterButton"

const MONDAY = 1
const WEEKLY_SEND_HOUR = 8
const WEEKLY_SEND_MINUTE = 0

const DAILY_SEND_HOUR = 19
const DAILY_SEND_MINUTE = 0

/** Prochain lundi 8h (aujourd'hui si on est lundi avant 8h, sinon le lundi suivant). */
function nextWeeklySend(from: Date): Date {
    const target = new Date(from)
    target.setHours(WEEKLY_SEND_HOUR, WEEKLY_SEND_MINUTE, 0, 0)

    const dayDiff = (MONDAY - target.getDay() + 7) % 7
    target.setDate(target.getDate() + dayDiff)

    if (target <= from) target.setDate(target.getDate() + 7)
    return target
}

/** Prochain 19h (aujourd'hui si pas encore passé, sinon demain). */
function nextDailySend(from: Date): Date {
    const target = new Date(from)
    target.setHours(DAILY_SEND_HOUR, DAILY_SEND_MINUTE, 0, 0)
    if (target <= from) target.setDate(target.getDate() + 1)
    return target
}

function formatRemaining(ms: number): string {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000))
    const days = Math.floor(totalSeconds / 86400)
    const hours = Math.floor((totalSeconds % 86400) / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    const pad = (n: number) => String(n).padStart(2, "0")
    return days > 0
        ? `${days}j ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
        : `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

/**
 * Compte à rebours (affichage seul) jusqu'à `next(now)`. L'envoi à l'échéance
 * est fait côté serveur par pg_cron → Edge Function `crm-stats-newsletter`
 * (migration 20260916100000_crm_stats_newsletter_cron.sql), que la page soit
 * ouverte ou non — un envoi depuis le navigateur ferait doublon.
 */
function useCountdown(next: (from: Date) => Date): string {
    const [remaining, setRemaining] = useState(
        () => next(new Date()).getTime() - Date.now()
    )

    useEffect(() => {
        const id = setInterval(() => {
            const now = new Date()
            setRemaining(next(now).getTime() - now.getTime())
        }, 1000)
        return () => clearInterval(id)
    }, [next])

    return formatRemaining(remaining)
}

interface SendCountdownCardProps {
    period: "week" | "day"
    icon: React.ReactNode
    label: string
    next: (from: Date) => Date
}

/**
 * Carte compte à rebours du digest stats CRM + bouton de test manuel. L'envoi
 * planifié part du cron Supabase, pas de cette carte.
 */
function SendCountdownCard({ period, icon, label, next }: SendCountdownCardProps) {
    const remaining = useCountdown(next)

    return (
        <Card variant="elevated">
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    {icon}
                    {label}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <p className="font-mono text-2xl font-semibold tabular-nums">
                    {remaining}
                </p>
                <SendTestNewsletterButton period={period} compact />
            </CardContent>
        </Card>
    )
}

/** Compte à rebours jusqu'au digest hebdomadaire (lundi 8h, semaine précédente). */
export function WeeklySendCountdown() {
    return (
        <AnalyticsProvider>
            <SendCountdownCard
                period="week"
                icon={<Clock className="h-4 w-4" />}
                label="Lundi 8h — semaine précédente"
                next={nextWeeklySend}
            />
        </AnalyticsProvider>
    )
}

/** Compte à rebours jusqu'au digest du soir (19h, stat du jour). */
export function DailySendCountdown() {
    return (
        <AnalyticsProvider>
            <SendCountdownCard
                period="day"
                icon={<Moon className="h-4 w-4" />}
                label="Tous les soirs 19h — stat du jour"
                next={nextDailySend}
            />
        </AnalyticsProvider>
    )
}
