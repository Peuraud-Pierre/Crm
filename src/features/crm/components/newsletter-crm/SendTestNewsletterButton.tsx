import { Loader2, Send } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { useSendCrmStatsNewsletter } from "./useSendCrmStatsNewsletter"

interface SendTestNewsletterButtonProps {
    /** Portée du classeur envoyé — "week" pour le digest du lundi, "day" pour celui du soir. */
    period: "week" | "day"
    /** Variante compacte (icône + libellé court) pour un placement à côté d'une horloge. */
    compact?: boolean
}

/**
 * Bouton de test bout-en-bout de l'envoi du digest stats CRM : construit le
 * même classeur que ExportStatsButton et l'envoie via
 * `POST /newsletter/upload` (service newsletter-console) au lieu de le
 * télécharger — même logique que le digest arrivage : pas de liste de
 * destinataires fournie par le front, le service résout lui-même les
 * abonnés `crm_stat = true` depuis la base.
 *
 * L'envoi planifié (lundi 8h / 19h) part du cron Supabase via l'Edge
 * Function `crm-stats-newsletter`, qui envoie les mêmes champs.
 */
export function SendTestNewsletterButton({
    period,
    compact = false,
}: SendTestNewsletterButtonProps) {
    const { sending, send, isPeriodReady } = useSendCrmStatsNewsletter(period)

    return (
        <Button
            variant="outline"
            size="sm"
            className={
                compact
                    ? "h-8 gap-1.5 rounded-lg border-dashed px-2 text-xs"
                    : "w-full lg:w-auto h-9 gap-2 rounded-xl border-dashed"
            }
            onClick={send}
            disabled={sending || !isPeriodReady}
            title="Envoyer un test du digest stats CRM par email"
        >
            {sending ? (
                <Loader2 className={compact ? "h-3.5 w-3.5 shrink-0 animate-spin" : "h-4 w-4 shrink-0 animate-spin"} />
            ) : (
                <Send className={compact ? "h-3.5 w-3.5 shrink-0" : "h-4 w-4 shrink-0"} />
            )}
            {compact ? "Tester" : "Envoyer un test"}
        </Button>
    )
}
