import { beforeEach, expect, rstest, test } from "@rstest/core"

const mocks = rstest.hoisted(() => {
    const tables: Record<string, { data: unknown; error: unknown }> = {}
    const calls: { table: string; method: string; args: unknown[] }[] = []
    const from = rstest.fn((table: string) => {
        const builder: Record<string, unknown> = {}
        for (const m of ["select", "order", "limit", "in"]) {
            builder[m] = rstest.fn((...args: unknown[]) => {
                calls.push({ table, method: m, args })
                return builder
            })
        }
        builder.then = (resolve: (v: unknown) => void) => resolve(tables[table])
        return builder
    })
    return { tables, calls, from }
})

rstest.mock("@/integrations/supabase/client", () => ({
    supabase: {
        from: mocks.from,
        auth: {
            getSession: async () => ({
                data: { session: { access_token: "tok" } },
            }),
        },
    },
}))

rstest.mock("@/shared/lib/env", () => ({
    env: { PUBLIC_NEWSLETTER_API_URL: "https://api.test" },
}))

const fetchMock = rstest.fn()

beforeEach(() => {
    fetchMock.mockReset()
    mocks.calls.length = 0
    globalThis.fetch = fetchMock as unknown as typeof fetch
})

// Objet minimal plutôt que `new Response` : l'environnement jsdom ne garantit
// pas les globaux fetch de Node.
const response = (status: number, body: string) => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
    json: async () => JSON.parse(body),
})

test("startClientNewsletterSend poste le brouillon avec le jeton", async () => {
    const { startClientNewsletterSend } = await import("./clientNewsletterService")
    fetchMock.mockResolvedValue(
        response(202, JSON.stringify({ id: "s1", recipient_count: 3 }))
    )

    const res = await startClientNewsletterSend({ subject: "S", message: "M" })

    expect(res).toEqual({ id: "s1", recipient_count: 3 })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("https://api.test/clients/newsletter/send")
    expect(init.method).toBe("POST")
    expect(init.headers.Authorization).toBe("Bearer tok")
    expect(JSON.parse(init.body)).toEqual({ subject: "S", message: "M" })
})

test("remonte le message du serveur (409) sans le saut de ligne final", async () => {
    const { startClientNewsletterSend } = await import("./clientNewsletterService")
    fetchMock.mockResolvedValue(response(409, "Un envoi est déjà en cours.\n"))

    await expect(
        startClientNewsletterSend({ subject: "S", message: "M" })
    ).rejects.toThrow(/^Un envoi est déjà en cours\.$/)
})

test("message par défaut quand le serveur ne renvoie rien", async () => {
    const { sendClientNewsletterTest } = await import("./clientNewsletterService")
    fetchMock.mockResolvedValue(response(502, ""))

    await expect(
        sendClientNewsletterTest({ subject: "S", message: "M" })
    ).rejects.toThrow("Erreur lors de l'envoi du test.")
})

test("fetchRecipientCount lit le compteur serveur", async () => {
    const { fetchRecipientCount } = await import("./clientNewsletterService")
    fetchMock.mockResolvedValue(response(200, JSON.stringify({ count: 42 })))

    expect(await fetchRecipientCount()).toBe(42)
    expect(fetchMock.mock.calls[0][0]).toBe(
        "https://api.test/clients/newsletter/recipients"
    )
})

test("fetchSendHistory joint le nom de l'auteur", async () => {
    const { fetchSendHistory } = await import("./clientNewsletterService")
    mocks.tables.client_newsletter_sends = {
        data: [
            { id: "s1", sent_by: "u1", subject: "A" },
            { id: "s2", sent_by: "u2", subject: "B" },
        ],
        error: null,
    }
    mocks.tables.profiles = {
        data: [{ user_id: "u1", full_name: "Noé" }],
        error: null,
    }

    const rows = await fetchSendHistory()

    expect(rows.map(r => r.author_name)).toEqual(["Noé", null])
    expect(
        mocks.calls.find(
            (c: { table: string; method: string }) =>
                c.table === "profiles" && c.method === "in"
        )?.args
    ).toEqual(["user_id", ["u1", "u2"]])
})

test("fetchSendHistory propage l'erreur Supabase", async () => {
    const { fetchSendHistory } = await import("./clientNewsletterService")
    mocks.tables.client_newsletter_sends = {
        data: null,
        error: { message: "permission denied" },
    }

    await expect(fetchSendHistory()).rejects.toThrow(
        "Erreur lors du chargement de l'historique."
    )
})
