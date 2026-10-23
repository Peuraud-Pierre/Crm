import { beforeEach, expect, rstest, test } from "@rstest/core"

const mocks = rstest.hoisted(() => {
    const state: { result: unknown } = { result: { data: null, error: null } }
    const calls: { upsert?: unknown; onConflict?: unknown } = {}

    const from = rstest.fn(() => {
        const builder: Record<string, unknown> = {}
        for (const m of ["select", "eq"]) {
            builder[m] = rstest.fn(() => builder)
        }
        builder.upsert = rstest.fn(
            (row: unknown, options: unknown) => {
                calls.upsert = row
                calls.onConflict = options
                return builder
            }
        )
        builder.maybeSingle = rstest.fn(() => Promise.resolve(state.result))
        builder.then = (resolve: (v: unknown) => void) =>
            resolve(state.result)
        return builder
    })

    return { state, calls, from }
})

rstest.mock("@/integrations/supabase/client", () => ({
    supabase: { from: mocks.from },
}))

import { fetchUserPreferences, saveUserPreferences } from "./preferencesService"

beforeEach(() => {
    rstest.clearAllMocks()
    mocks.state.result = { data: null, error: null }
    delete mocks.calls.upsert
    delete mocks.calls.onConflict
})

test("fetchUserPreferences renvoie null quand aucune ligne n'existe", async () => {
    mocks.state.result = { data: null, error: null }

    await expect(fetchUserPreferences("u1")).resolves.toBeNull()
})

test("fetchUserPreferences renvoie les préférences enregistrées", async () => {
    mocks.state.result = {
        data: {
            user_id: "u1",
            theme: "dark",
            push_enabled: false,
            notify_ticket: true,
            notify_message: false,
            notify_system: true,
        },
        error: null,
    }

    await expect(fetchUserPreferences("u1")).resolves.toEqual({
        user_id: "u1",
        theme: "dark",
        push_enabled: false,
        notify_ticket: true,
        notify_message: false,
        notify_system: true,
    })
})

test("fetchUserPreferences propage l'erreur Supabase", async () => {
    mocks.state.result = { data: null, error: new Error("rls") }

    await expect(fetchUserPreferences("u1")).rejects.toThrow("rls")
})

test("saveUserPreferences upsert sur user_id avec le patch fourni", async () => {
    await saveUserPreferences("u1", { theme: "light" })

    expect(mocks.calls.upsert).toEqual({ user_id: "u1", theme: "light" })
    expect(mocks.calls.onConflict).toEqual({ onConflict: "user_id" })
})

test("saveUserPreferences propage l'erreur Supabase", async () => {
    mocks.state.result = { data: null, error: new Error("écriture refusée") }

    await expect(
        saveUserPreferences("u1", { push_enabled: false })
    ).rejects.toThrow("écriture refusée")
})
