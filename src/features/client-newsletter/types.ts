export interface NewsletterDraft {
    subject: string
    message: string
}

export interface SendStarted {
    id: string
    recipient_count: number
}

export type ClientNewsletterSendStatus = "sending" | "done" | "failed"

/** Ligne de `client_newsletter_sends` + nom de l'auteur (profiles). */
export interface ClientNewsletterSend {
    id: string
    subject: string
    message: string
    sent_by: string
    status: ClientNewsletterSendStatus
    recipient_count: number
    sent_count: number
    failed_count: number
    error: string | null
    created_at: string
    finished_at: string | null
    author_name: string | null
}
