import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import {
    getISOWeek,
    getPeriodRange,
    useAnalytics,
} from "@/features/crm/context/AnalyticsContext"
import { buildStatsWorkbook } from "@/features/crm/components/Analytics/buildStatsWorkbook"
import { sendCrmStatsTestNewsletter } from "@/features/crm/services/crmStatsNewsletterService"

const toISODate = (d: Date) => d.toISOString().slice(0, 10)

/**
 * Logique d'envoi du digest stats CRM (construction du classeur + appel
 * `POST /newsletter/upload`) pour le bouton de test manuel
 * (`SendTestNewsletterButton`). L'envoi planifié est fait par l'Edge Function
 * `supabase/functions/crm-stats-newsletter`, qui reproduit ce calcul côté
 * serveur — toute évolution ici doit y être reportée.
 */
export function useSendCrmStatsNewsletter(period: "week" | "day") {
    const analytics = useAnalytics()
    const [sending, setSending] = useState(false)

    useEffect(() => {
        analytics.setSelectedPeriod(period)
    }, [period])

    const isPeriodReady = analytics.selectedPeriod === period

    const send = useCallback(async () => {
        setSending(true)
        try {
            const { wb, filename } = buildStatsWorkbook(analytics)
            const range = getPeriodRange(
                analytics.selectedPeriod,
                analytics.selectedFilter
            )
            const now = new Date()
            const start = range?.start ?? now
            const end = range?.end ?? now

            const result = await sendCrmStatsTestNewsletter({
                wb,
                filename,
                weekNumber: getISOWeek(now),
                startDate: toISODate(start),
                endDate: toISODate(end),
                period,
            })

            if (result.failed > 0) {
                toast.error(
                    `Échec de l'envoi (${result.failed} destinataire${result.failed > 1 ? "s" : ""}).`
                )
            } else {
                toast.success("Newsletter de test envoyée.")
            }
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Erreur lors de l'envoi du test."
            )
        } finally {
            setSending(false)
        }
    }, [analytics, period])

    return { sending, send, isPeriodReady }
}
