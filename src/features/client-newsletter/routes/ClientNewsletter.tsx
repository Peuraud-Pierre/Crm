import { Mail } from "lucide-react"
import { NewsletterComposer } from "@/features/client-newsletter/components/NewsletterComposer"
import { SendHistory } from "@/features/client-newsletter/components/SendHistory"
import { useNewsletterHistory } from "@/features/client-newsletter/hooks/data/useNewsletterHistory"
import { useNewsletterRecipientCount } from "@/features/client-newsletter/hooks/data/useNewsletterRecipientCount"

/** Page « Newsletter » (catégorie Commercial) : rédaction + historique. */
export default function ClientNewsletter() {
    const {
        count,
        error: countError,
        reload: reloadCount,
    } = useNewsletterRecipientCount()
    const { sends, loading, hasActiveSend, reload } = useNewsletterHistory()

    return (
        <div className="flex-1 p-4 sm:p-6 space-y-6">
            <header className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Mail className="w-5 h-5" />
                </div>
                <div>
                    <h1 className="text-xl font-bold tracking-tight">Newsletter clients</h1>
                    <p className="text-sm text-muted-foreground">
                        Envoyez un mail à tous les clients abonnés (case « Abonné à
                        la newsletter » sur la fiche client).
                    </p>
                </div>
            </header>
            <NewsletterComposer
                recipientCount={count}
                countError={countError}
                onRetryCount={reloadCount}
                hasActiveSend={hasActiveSend}
                onSent={() => {
                    void reload()
                    reloadCount()
                }}
            />
            <SendHistory sends={sends} loading={loading} />
        </div>
    )
}
