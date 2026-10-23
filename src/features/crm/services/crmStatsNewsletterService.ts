import XLSX from "xlsx-js-style"
import { supabase } from "@/integrations/supabase/client"
import { env } from "@/shared/lib/env"

const NEWSLETTER_API = env.PUBLIC_NEWSLETTER_API_URL ?? ""

export interface SendCrmStatsResult {
    sent: number
    failed: number
    failedEmails?: string[]
}

async function authHeaders(): Promise<HeadersInit> {
    const {
        data: { session },
    } = await supabase.auth.getSession()
    return { Authorization: `Bearer ${session?.access_token}` }
}

/**
 * Emails candidats pour le digest stats CRM — le champ `emails` est requis
 * par `POST /newsletter/upload`, mais c'est le service qui filtre ensuite
 * cette liste sur `crm_stat = true` (il "récupère ceux qu'il lui faut") :
 * pas de filtrage côté front, on transmet tout l'univers des abonnés.
 */
async function fetchCrmStatCandidateEmails(): Promise<string[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
        .from("newsletter_subscriptions")
        .select("email")
    if (error) throw new Error("Erreur lors du chargement des destinataires.")
    return ((data as { email: string }[] | null) ?? []).map(row => row.email)
}

/**
 * Envoie le classeur de stats CRM via `POST /newsletter/upload` (service
 * newsletter-console, `internal/crm.UploadHandler`) — même endpoint que le
 * digest hebdomadaire arrivage, réutilisé tel quel (upload multipart brut).
 */
export async function sendCrmStatsTestNewsletter(input: {
    wb: XLSX.WorkBook
    filename: string
    weekNumber: number
    startDate: string
    endDate: string
    /** Créneau d'origine de l'envoi — "week" (lundi 8h) ou "day" (tous les soirs 19h). */
    period: "week" | "day"
}): Promise<SendCrmStatsResult> {
    const bytes = XLSX.write(input.wb, { type: "array", bookType: "xlsx" })
    const file = new File([bytes], input.filename, {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })

    const emails = await fetchCrmStatCandidateEmails()

    const form = new FormData()
    form.set("file", file)
    form.set("week_number", String(input.weekNumber))
    form.set("start_date", input.startDate)
    form.set("end_date", input.endDate)
    form.set("period", input.period)
    form.set("emails", JSON.stringify(emails))

    const res = await fetch(`${NEWSLETTER_API}/newsletter/upload`, {
        method: "POST",
        headers: await authHeaders(),
        body: form,
    })
    if (!res.ok) {
        const msg = await res.text()
        throw new Error(msg || "Erreur lors de l'envoi du test.")
    }
    return (await res.json()) as SendCrmStatsResult
}
