import { expect, test } from "@rstest/core"
import { buildDashboardAlerts } from "@/features/arrivage-admin/utils/alerts"
import type {
    NewsletterStats,
    SendRun,
    ServiceHealth,
} from "@/features/arrivage-admin/types"

const HEALTHY: ServiceHealth = {
    reachable: true,
    status: { debounce: "idle" },
}

function makeRun(overrides: Partial<SendRun> = {}): SendRun {
    return {
        id: "run-1",
        trigger: "webhook",
        triggered_by: null,
        started_at: "2026-08-17T10:00:00.000Z",
        finished_at: "2026-08-17T10:01:00.000Z",
        status: "success",
        rows_count: 12,
        subscribers_total: 10,
        sent_count: 10,
        failed_count: 0,
        duration_ms: 60_000,
        error: null,
        ...overrides,
    }
}

function makeStats(overrides: Partial<NewsletterStats> = {}): NewsletterStats {
    return {
        days: 30,
        sent: 100,
        failed: 0,
        failure_rate: 0,
        runs_total: 10,
        runs_failed: 0,
        avg_run_duration_ms: 45_000,
        last_run: makeRun(),
        daily: [],
        subscribers: { total: 10, active: 10, inactive: 0, new: 1 },
        invitation_codes: { available: 5, used: 10 },
        ...overrides,
    }
}

const ids = (health: ServiceHealth, stats: NewsletterStats | null, err: string | null = null) =>
    buildDashboardAlerts(health, stats, err).map(a => a.id)

test("aucune alerte quand tout va bien", () => {
    expect(buildDashboardAlerts(HEALTHY, makeStats(), null)).toEqual([])
})

test("une API injoignable masque les autres symptômes", () => {
    // Tout le reste découle de la même panne : empiler les alertes noierait la
    // cause racine.
    const health: ServiceHealth = { reachable: false, status: null }
    const stats = makeStats({
        last_run: makeRun({ status: "failed" }),
        invitation_codes: { available: 0, used: 10 },
    })

    expect(ids(health, stats, "boom")).toEqual(["api-unreachable"])
})

test("l'état inconnu au premier chargement ne déclenche pas d'alerte", () => {
    // `reachable: null` = le ping n'a pas encore répondu. Alerter là-dessus
    // ferait clignoter une fausse panne à chaque ouverture de la page.
    const health: ServiceHealth = { reachable: null, status: null }
    expect(buildDashboardAlerts(health, makeStats(), null)).toEqual([])
})

test("un dernier envoi échoué ou interrompu remonte en destructive", () => {
    for (const status of ["failed", "aborted"] as const) {
        const alerts = buildDashboardAlerts(
            HEALTHY,
            makeStats({ last_run: makeRun({ status, error: "SMTP indisponible" }) }),
            null
        )
        expect(alerts[0].id).toBe("last-run-failed")
        expect(alerts[0].tone).toBe("destructive")
        expect(alerts[0].description).toBe("SMTP indisponible")
    }
})

test("un envoi partiel est un avertissement, pas une panne", () => {
    const alerts = buildDashboardAlerts(
        HEALTHY,
        makeStats({
            last_run: makeRun({
                status: "partial",
                sent_count: 7,
                failed_count: 3,
            }),
        }),
        null
    )
    expect(alerts[0].id).toBe("last-run-partial")
    expect(alerts[0].tone).toBe("warning")
    expect(alerts[0].description).toContain("3")
})

test("le taux d'échec n'alerte pas sur un échantillon trop faible", () => {
    // 1 échec sur 3 envois, c'est 33 % — mais statistiquement vide.
    const petitVolume = makeStats({
        sent: 2,
        failed: 1,
        failure_rate: 1 / 3,
        last_run: makeRun({ status: "success" }),
    })
    expect(ids(HEALTHY, petitVolume)).not.toContain("failure-rate")

    const volumeSuffisant = makeStats({
        sent: 90,
        failed: 10,
        failure_rate: 0.1,
        last_run: makeRun({ status: "success" }),
    })
    expect(ids(HEALTHY, volumeSuffisant)).toContain("failure-rate")
})

test("le stock de codes d'invitation alerte au seuil bas et à zéro", () => {
    const bas = makeStats({ invitation_codes: { available: 2, used: 8 } })
    expect(ids(HEALTHY, bas)).toContain("low-invitation-codes")

    const epuise = makeStats({ invitation_codes: { available: 0, used: 10 } })
    const alerte = buildDashboardAlerts(HEALTHY, epuise, null).find(
        a => a.id === "low-invitation-codes"
    )
    expect(alerte?.title).toContain("Plus aucun code")

    const confortable = makeStats({ invitation_codes: { available: 20, used: 3 } })
    expect(ids(HEALTHY, confortable)).not.toContain("low-invitation-codes")
})

test("aucun abonné actif alerte, mais pas une base vide", () => {
    const tousDesactives = makeStats({
        subscribers: { total: 8, active: 0, inactive: 8, new: 0 },
    })
    expect(ids(HEALTHY, tousDesactives)).toContain("no-active-subscriber")

    // Une base encore vide n'est pas une anomalie : c'est le jour 1.
    const baseVide = makeStats({
        subscribers: { total: 0, active: 0, inactive: 0, new: 0 },
    })
    expect(ids(HEALTHY, baseVide)).not.toContain("no-active-subscriber")
})

test("une erreur de stats est signalée même sans données", () => {
    const alerts = buildDashboardAlerts(HEALTHY, null, "503 Service Unavailable")
    expect(alerts.map(a => a.id)).toEqual(["stats-error"])
    expect(alerts[0].description).toBe("503 Service Unavailable")
})

test("les alertes sont ordonnées de la plus grave à la moins grave", () => {
    const alerts = buildDashboardAlerts(
        HEALTHY,
        makeStats({
            sent: 80,
            failed: 20,
            failure_rate: 0.2,
            last_run: makeRun({ status: "failed" }),
            invitation_codes: { available: 0, used: 10 },
            subscribers: { total: 5, active: 0, inactive: 5, new: 0 },
        }),
        null
    )
    expect(alerts[0].tone).toBe("destructive")
    // Une fois la première passée, plus aucune destructive ne doit suivre.
    expect(alerts.slice(1).every(a => a.tone === "warning")).toBe(true)
})

/*
 * pg_net — la panne du 26/08. Le service Go répondait, les envois manuels
 * partaient, et pourtant plus rien ne sortait de la base. L'alerte doit
 * remonter dans ce cas précis, et surtout ne pas être avalée par l'alerte
 * « service injoignable » quand les deux se produisent.
 */

test("une file pg_net bloquée est signalée en tête", () => {
    const alerts = buildDashboardAlerts(
        {
            ...HEALTHY,
            pgNet: { available: true, queue_depth: 295, stalled: true },
        },
        null,
        null
    )

    expect(alerts[0].id).toBe("pg-net-stalled")
    expect(alerts[0].tone).toBe("destructive")
    expect(alerts[0].description).toContain("295")
})

test("une file qui avance ne déclenche aucune alerte", () => {
    const alerts = buildDashboardAlerts(
        {
            ...HEALTHY,
            pgNet: { available: true, queue_depth: 12, stalled: false },
        },
        null,
        null
    )

    expect(alerts.some(a => a.id.startsWith("pg-net"))).toBe(false)
})

test("pg_net absent est distingué d'une file bloquée", () => {
    const alerts = buildDashboardAlerts(
        { ...HEALTHY, pgNet: { available: false } },
        null,
        null
    )

    expect(alerts[0].id).toBe("pg-net-absent")
})

test("l'alerte pg_net survit à l'early-return du service injoignable", () => {
    const alerts = buildDashboardAlerts(
        {
            reachable: false,
            status: null,
            pgNet: { available: true, queue_depth: 8, stalled: true },
        },
        null,
        null
    )

    // Deux causes distinctes, deux corrections distinctes : les deux doivent
    // être visibles.
    expect(alerts.map(a => a.id)).toEqual(["pg-net-stalled", "api-unreachable"])
})

test("sans données pg_net, le comportement existant est inchangé", () => {
    const alerts = buildDashboardAlerts(HEALTHY, null, null)

    expect(alerts.some(a => a.id.startsWith("pg-net"))).toBe(false)
})

/*
 * Orphelines vs blocage — la distinction établie le 27/08 : des requêtes
 * restaient dans la file pendant que des requêtes plus récentes passaient
 * en 200. Relancer le worker n'y change rien, et l'action à mener n'est pas
 * la même. Les deux cas ne doivent jamais être présentés pareil.
 */

test("des requêtes orphelines ne sont pas signalées comme un blocage", () => {
    const alerts = buildDashboardAlerts(
        {
            ...HEALTHY,
            pgNet: {
                available: true,
                queue_depth: 295,
                oldest_id: 6180,
                stalled: true,
                orphaned: true,
            },
        },
        null,
        null
    )

    expect(alerts[0].id).toBe("pg-net-orphaned")
    expect(alerts[0].tone).toBe("warning")
    expect(alerts[0].description).toContain("6180")
    expect(alerts.some(a => a.id === "pg-net-stalled")).toBe(false)
})

test("un blocage réel reste bien un blocage", () => {
    const alerts = buildDashboardAlerts(
        {
            ...HEALTHY,
            pgNet: {
                available: true,
                queue_depth: 12,
                stalled: true,
                orphaned: false,
            },
        },
        null,
        null
    )

    expect(alerts[0].id).toBe("pg-net-stalled")
    expect(alerts[0].tone).toBe("destructive")
})
