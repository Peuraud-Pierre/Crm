import { expect, test } from "@rstest/core"
import { buildWebhookPingVerdict } from "@/features/arrivage-admin/utils/webhookPing"
import type { WebhookPingStart } from "@/features/arrivage-admin/types"

const SENT: WebhookPingStart = {
    ok: true,
    trigger_found: true,
    trigger_name: "arrivage_manuel_newsletter_webhook",
    trigger_enabled: true,
    url: "https://newsletter.example.test/webhook",
    request_id: 42,
}

test("un 200 vaut chaîne opérationnelle", () => {
    const v = buildWebhookPingVerdict(SENT, {
        state: "done",
        status_code: 200,
        timed_out: false,
        error_msg: null,
    })

    expect(v.tone).toBe("success")
    expect(v.remedy).toBeNull()
    expect(v.statusCode).toBe(200)
    expect(v.url).toBe(SENT.url)
})

test("un 401 désigne le secret, pas le réseau", () => {
    const v = buildWebhookPingVerdict(SENT, {
        state: "done",
        status_code: 401,
        timed_out: false,
        error_msg: null,
    })

    expect(v.tone).toBe("destructive")
    expect(v.remedy).toContain("WEBHOOK_SECRET")
})

test("un timeout désigne le proxy, pas le secret", () => {
    const v = buildWebhookPingVerdict(SENT, {
        state: "done",
        status_code: null,
        timed_out: true,
        error_msg: null,
    })

    expect(v.tone).toBe("destructive")
    expect(v.remedy).toContain("reverse proxy")
})

test("une erreur réseau est reprise telle quelle dans le détail", () => {
    const v = buildWebhookPingVerdict(SENT, {
        state: "done",
        status_code: null,
        timed_out: false,
        error_msg: "Timeout was reached",
    })

    expect(v.tone).toBe("destructive")
    expect(v.detail).toContain("Timeout was reached")
})

// La distinction qui compte : une requête bloquée dans la file de pg_net n'est
// pas une réponse en retard, c'est un worker arrêté — donc plus AUCUN webhook
// qui sort de la base, et un remède précis.
test("une requête restée en file signale un worker pg_net arrêté", () => {
    const v = buildWebhookPingVerdict(SENT, { state: "queued" })

    expect(v.tone).toBe("destructive")
    expect(v.remedy).toContain("worker_restart")
})

test("aucune réponse du tout reste non concluant", () => {
    const v = buildWebhookPingVerdict(SENT, null)

    expect(v.tone).toBe("warning")
})

test("un trigger absent est signalé sans qu'aucune requête ne parte", () => {
    const v = buildWebhookPingVerdict(
        { ok: false, reason: "trigger_absent", trigger_found: false },
        null
    )

    expect(v.tone).toBe("destructive")
    expect(v.title).toContain("disparu")
    expect(v.statusCode).toBeNull()
})

test("un trigger désactivé propose la commande de réactivation exacte", () => {
    const v = buildWebhookPingVerdict(
        {
            ok: false,
            reason: "trigger_disabled",
            trigger_found: true,
            trigger_name: "arrivage_manuel_newsletter_webhook",
        },
        null
    )

    expect(v.tone).toBe("destructive")
    expect(v.remedy).toContain(
        "ENABLE TRIGGER arrivage_manuel_newsletter_webhook"
    )
})

test("pg_net absent est distingué d'un trigger manquant", () => {
    const v = buildWebhookPingVerdict({ ok: false, reason: "pg_net_absent" }, null)

    expect(v.tone).toBe("destructive")
    expect(v.title).toContain("pg_net")
})
