import { beforeEach, expect, rstest, test } from "@rstest/core"

const mocks = rstest.hoisted(() => {
    const state = { result: { data: null, error: null } as unknown }

    const from = rstest.fn(() => {
        const builder: Record<string, unknown> = {}
        for (const m of ["select", "eq"]) {
            builder[m] = rstest.fn(() => builder)
        }
        builder.maybeSingle = rstest.fn(() => Promise.resolve(state.result))
        return builder
    })

    return { state, from }
})

rstest.mock("@/integrations/supabase/client", () => ({
    supabase: { from: mocks.from },
}))

rstest.mock("./profileService", () => ({
    getAccessToken: rstest.fn(() => Promise.resolve("jwt")),
}))

import {
    fetchNewsletterSubscription,
    subscribeToNewsletter,
    unsubscribeFromNewsletter,
} from "./newsletterService"

const fetchMock = rstest.fn()

beforeEach(() => {
    rstest.clearAllMocks()
    mocks.state.result = { data: null, error: null }
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({ ok: true, text: () => Promise.resolve("") })
    globalThis.fetch = fetchMock as unknown as typeof fetch
})

test("fetchNewsletterSubscription renvoie null hors abonnement", async () => {
    await expect(fetchNewsletterSubscription("u1")).resolves.toBeNull()
})

test("fetchNewsletterSubscription normalise des colonnes absentes", async () => {
    mocks.state.result = {
        data: { active: true, visible_columns: null },
        error: null,
    }

    await expect(fetchNewsletterSubscription("u1")).resolves.toEqual({
        active: true,
        visible_columns: [],
    })
})

test("fetchNewsletterSubscription propage l'erreur Supabase", async () => {
    mocks.state.result = { data: null, error: new Error("rls") }

    await expect(fetchNewsletterSubscription("u1")).rejects.toThrow("rls")
})

test("subscribeToNewsletter poste le payload avec le jeton d'auth", async () => {
    await subscribeToNewsletter({
        email: "a@b.c",
        full_name: "Ada",
        visible_columns: ["status"],
        invitation_code: "ARV-1",
    })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url.endsWith("/subscribe")).toBe(true)
    expect(init.method).toBe("POST")
    expect(
        (init.headers as Record<string, string>).Authorization
    ).toBe("Bearer jwt")
    expect(JSON.parse(init.body as string).visible_columns).toEqual(["status"])
})

test("subscribeToNewsletter remonte le message d'erreur du service", async () => {
    fetchMock.mockResolvedValue({
        ok: false,
        text: () => Promise.resolve("Code d'invitation invalide."),
    })

    await expect(
        subscribeToNewsletter({
            email: "a@b.c",
            full_name: "Ada",
            visible_columns: ["status"],
            invitation_code: "NOPE",
        })
    ).rejects.toThrow("Code d'invitation invalide.")
})

test("unsubscribeFromNewsletter appelle DELETE /unsubscribe", async () => {
    await unsubscribeFromNewsletter()

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url.endsWith("/unsubscribe")).toBe(true)
    expect(init.method).toBe("DELETE")
})
