// ── services/clientNewsletterService.ts ──────────────────────────────────────
// Newsletter clients : routes du service Go newsletter-console
// (/clients/newsletter/*, permission newsletter_clients.send) et lecture de
// l'historique `client_newsletter_sends` (écrit par le service Go seul).
//
// `client_newsletter_sends` n'est pas encore dans les types Supabase générés :
// casts `as any` ponctuels, comme arrivage-admin/services/newsletterService.ts.

import { supabase } from "@/integrations/supabase/client"
import { env } from "@/shared/lib/env"
import type {
    ClientNewsletterSend,
    NewsletterDraft,
    SendStarted,
} from "@/features/client-newsletter/types"

const NEWSLETTER_API = env.PUBLIC_NEWSLETTER_API_URL ?? ""

async function authHeaders(): Promise<Record<string, string>> {
    const {
        data: { session },
    } = await supabase.auth.getSession()
    return { Authorization: `Bearer ${session?.access_token}` }
}

/** Le service Go renvoie des messages français via http.Error (suivis d'un \n). */
async function readJSON<T>(res: Response, fallback: string): Promise<T> {
    if (!res.ok) {
        const msg = (await res.text()).trim()
        throw new Error(msg || fallback)
    }
    return (await res.json()) as T
}

async function postDraft<T>(
    path: string,
    draft: NewsletterDraft,
    fallback: string
): Promise<T> {
    const res = await fetch(`${NEWSLETTER_API}${path}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(await authHeaders()),
        },
        body: JSON.stringify({ subject: draft.subject, message: draft.message }),
    })
    return readJSON<T>(res, fallback)
}

/** Nombre exact de mails qui partiront (filtre + dédoublonnage serveur). */
export async function fetchRecipientCount(signal?: AbortSignal): Promise<number> {
    const res = await fetch(`${NEWSLETTER_API}/clients/newsletter/recipients`, {
        method: "GET",
        headers: await authHeaders(),
        signal,
    })
    const body = await readJSON<{ count: number }>(
        res,
        "Erreur lors du comptage des destinataires."
    )
    return body.count
}

export function startClientNewsletterSend(
    draft: NewsletterDraft
): Promise<SendStarted> {
    return postDraft<SendStarted>(
        "/clients/newsletter/send",
        draft,
        "Erreur lors du lancement de l'envoi."
    )
}

export function sendClientNewsletterTest(
    draft: NewsletterDraft
): Promise<{ to: string }> {
    return postDraft<{ to: string }>(
        "/clients/newsletter/test",
        draft,
        "Erreur lors de l'envoi du test."
    )
}

type SendRow = Omit<ClientNewsletterSend, "author_name">

export async function fetchSendHistory(
    limit = 20
): Promise<ClientNewsletterSend[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
        .from("client_newsletter_sends")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit)
    if (error) throw new Error("Erreur lors du chargement de l'historique.")
    const rows = (data as SendRow[] | null) ?? []

    const authorIds = [...new Set(rows.map(r => r.sent_by))]
    const names = new Map<string, string | null>()
    if (authorIds.length > 0) {
        const { data: profiles } = await supabase
            .from("profiles")
            .select("user_id, full_name")
            .in("user_id", authorIds)
        for (const p of profiles ?? []) names.set(p.user_id, p.full_name)
    }

    return rows.map(r => ({ ...r, author_name: names.get(r.sent_by) ?? null }))
}
