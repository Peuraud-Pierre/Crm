// Digest stats CRM déclenché par pg_cron (cf. migration
// 20260916100000_crm_stats_newsletter_cron.sql) — part même si personne n'a
// l'application ouverte.
//
// Équivalent serveur de `useSendCrmStatsNewsletter` (front) : construit le
// même classeur que ExportStatsButton puis l'envoie via
// `POST /newsletter/upload` (service newsletter-console), avec les mêmes
// champs de formulaire.
//
// Corps attendu : { "period": "week" | "day", "hour"?: number }
// `hour` = heure de Paris visée. pg_cron tourne en UTC : le job est planifié
// sur les deux heures UTC possibles (heure d'été / d'hiver) et la fonction
// ignore l'appel qui ne tombe pas à la bonne heure locale.
//
// Secrets requis (supabase secrets set) :
//   - CRM_STATS_CRON_SECRET : doit égaler l'en-tête `x-cron-secret` envoyé
//     par le cron (secret vault `crm_stats_newsletter_cron_secret`).
//   - NEWSLETTER_API_URL    : même valeur que PUBLIC_NEWSLETTER_API_URL.
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY sont fournis par la plateforme.
import { createClient } from "@supabase/supabase-js"
import XLSX from "xlsx-js-style"
import {
    buildPeriodContext,
    buildStatsExportData,
    loadStatsSources,
    type Period,
    toWall,
} from "./stats.ts"
import { buildStatsWorkbook } from "./workbook.ts"

const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    })

const requireEnv = (name: string) => {
    const v = Deno.env.get(name)
    if (!v) throw new Error(`Variable d'environnement manquante : ${name}`)
    return v
}

Deno.serve(async (req) => {
    if (req.method !== "POST") return json(405, { error: "method not allowed" })

    const expected = Deno.env.get("CRM_STATS_CRON_SECRET")
    if (!expected || req.headers.get("x-cron-secret") !== expected) {
        return json(401, { error: "unauthorized" })
    }

    let body: { period?: unknown; hour?: unknown }
    try {
        body = await req.json()
    } catch {
        return json(400, { error: "invalid json" })
    }
    const period = body.period
    if (period !== "week" && period !== "day") {
        return json(400, { error: "period must be 'week' or 'day'" })
    }

    const now = new Date()
    if (typeof body.hour === "number") {
        const parisHour = toWall(now).getUTCHours()
        if (parisHour !== body.hour) {
            return json(200, { skipped: true, parisHour, expected: body.hour })
        }
    }

    try {
        const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY")
        const newsletterApi = requireEnv("NEWSLETTER_API_URL")
        const supabase = createClient(requireEnv("SUPABASE_URL"), serviceKey, {
            auth: { persistSession: false, autoRefreshToken: false },
        })

        const ctx = buildPeriodContext(period as Period, now)
        const sources = await loadStatsSources(supabase, ctx)
        const { wb, filename } = buildStatsWorkbook(
            buildStatsExportData(sources, ctx)
        )

        // crmStatsNewsletterService.fetchCrmStatCandidateEmails : tout
        // l'univers des abonnés, le service Go filtre sur crm_stat = true.
        const { data: subs, error: subsError } = await supabase
            .from("newsletter_subscriptions")
            .select("email")
        if (subsError) throw new Error(`newsletter_subscriptions : ${subsError.message}`)
        const emails = ((subs ?? []) as { email: string }[]).map((r) => r.email)

        const bytes = XLSX.write(wb, { type: "array", bookType: "xlsx" })
        const form = new FormData()
        form.set(
            "file",
            new File([bytes], filename, {
                type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            })
        )
        form.set("week_number", String(ctx.weekNumber))
        form.set("start_date", ctx.startDate)
        form.set("end_date", ctx.endDate)
        form.set("period", period)
        form.set("emails", JSON.stringify(emails))

        const res = await fetch(`${newsletterApi}/newsletter/upload`, {
            method: "POST",
            headers: { Authorization: `Bearer ${serviceKey}` },
            body: form,
        })
        const text = await res.text()
        if (!res.ok) {
            console.error("[crm-stats-newsletter] upload ❌", res.status, text)
            return json(502, { error: "upload failed", status: res.status, body: text })
        }

        console.log("[crm-stats-newsletter] envoyé", {
            period,
            filter: ctx.filter,
            filename,
            result: text,
        })
        return json(200, { period, filter: ctx.filter, filename, result: JSON.parse(text) })
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error("[crm-stats-newsletter] ❌", message)
        return json(500, { error: message })
    }
})
