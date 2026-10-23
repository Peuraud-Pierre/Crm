import { beforeEach, expect, rstest, test } from "@rstest/core"

const mocks = rstest.hoisted(() => {
    const results = new Map<string, unknown>()
    const builders = new Map<
        string,
        Record<string, ReturnType<typeof rstest.fn>>
    >()

    const from = rstest.fn((table: string) => {
        const builder: Record<string, unknown> = {}
        for (const m of [
            "select",
            "order",
            "insert",
            "update",
            "delete",
            "eq",
            "is",
        ]) {
            builder[m] = rstest.fn(() => builder)
        }
        builder.then = (resolve: (v: unknown) => void) =>
            resolve(results.get(table) ?? { data: null, error: null })
        builders.set(
            table,
            builder as Record<string, ReturnType<typeof rstest.fn>>
        )
        return builder
    })

    const getSession = rstest.fn()
    const fetchMock = rstest.fn()

    return { results, builders, from, getSession, fetchMock }
})

rstest.mock("@/integrations/supabase/client", () => ({
    supabase: {
        from: mocks.from,
        auth: { getSession: mocks.getSession },
    },
}))

rstest.mock("@/shared/lib/env", () => ({
    env: { PUBLIC_SUPABASE_URL: "https://sb.test" },
}))

import {
    countProfilesByAssignment,
    createUser,
    deleteUser,
    inviteUser,
    listProfiles,
    updateProfile,
} from "./userAdminService"

beforeEach(() => {
    rstest.clearAllMocks()
    mocks.results.clear()
    mocks.builders.clear()
    globalThis.fetch = mocks.fetchMock as unknown as typeof fetch
    mocks.getSession.mockResolvedValue({
        data: { session: { access_token: "tok-1" } },
    })
    mocks.fetchMock.mockResolvedValue({ ok: true })
})

test("listProfiles normalise les jointures rôle/service (objet, tableau ou null)", async () => {
    mocks.results.set("profiles", {
        data: [
            {
                id: "1",
                user_id: "u1",
                email: "a@b.c",
                full_name: "A",
                avatar_url: null,
                status: "active",
                last_login: null,
                created_at: "2026-01-01",
                updated_at: "2026-01-01",
                role_id: "r1",
                service_id: "s1",
                role: { id: "r1", nom: "Admin" },
                service: [{ id: "s1", nom: "IT" }],
            },
            {
                id: "2",
                user_id: "u2",
                email: "b@b.c",
                full_name: "B",
                avatar_url: null,
                status: "pending",
                last_login: null,
                created_at: "2026-01-01",
                updated_at: "2026-01-01",
                role_id: null,
                service_id: null,
                role: null,
                service: [],
            },
        ],
        error: null,
    })

    const profiles = await listProfiles()
    expect(profiles[0].role).toEqual({ id: "r1", nom: "Admin" })
    expect(profiles[0].service).toEqual({ id: "s1", nom: "IT" })
    expect(profiles[1].role).toBeNull()
    expect(profiles[1].service).toBeNull()
})

test("countProfilesByAssignment agrège par rôle et service en ignorant les null", async () => {
    mocks.results.set("profiles", {
        data: [
            { role_id: "r1", service_id: "s1" },
            { role_id: "r1", service_id: "s2" },
            { role_id: "r2", service_id: null },
            { role_id: null, service_id: "s1" },
        ],
        error: null,
    })

    const { byRole, byService } = await countProfilesByAssignment()
    expect(byRole.get("r1")).toBe(2)
    expect(byRole.get("r2")).toBe(1)
    expect(byRole.size).toBe(2)
    expect(byService.get("s1")).toBe(2)
    expect(byService.get("s2")).toBe(1)
    expect(byService.size).toBe(2)
})

test("updateProfile jette si aucune ligne mise à jour (RLS silencieuse)", async () => {
    mocks.results.set("profiles", { data: [], error: null })
    await expect(updateProfile("u1", { full_name: "X" })).rejects.toThrow(
        "Aucune ligne mise à jour"
    )
})

test("updateProfile cible user_id et resélectionne la ligne", async () => {
    mocks.results.set("profiles", { data: [{ user_id: "u1" }], error: null })
    await updateProfile("u1", { role_id: "r2" })
    const builder = mocks.builders.get("profiles")
    expect(builder?.update).toHaveBeenCalledWith({ role_id: "r2" })
    expect(builder?.eq).toHaveBeenCalledWith("user_id", "u1")
    expect(builder?.select).toHaveBeenCalledWith("user_id")
})

test("createUser poste le payload complet sur keyexchange avec bearer", async () => {
    await createUser({
        email: "a@b.c",
        full_name: "A",
        role: "r1",
        service: "s1",
        password: "Secret1!",
    })

    expect(mocks.fetchMock).toHaveBeenCalledWith(
        "https://sb.test/keyexchange/api/admin/create-user",
        expect.objectContaining({
            method: "POST",
            headers: expect.objectContaining({
                Authorization: "Bearer tok-1",
            }),
            body: JSON.stringify({
                email: "a@b.c",
                full_name: "A",
                role: "r1",
                service: "s1",
                password: "Secret1!",
            }),
        })
    )
})

test("inviteUser poste sans mot de passe sur invite-user", async () => {
    await inviteUser({
        email: "a@b.c",
        full_name: "A",
        role: "r1",
        service: "s1",
    })

    const [url, init] = mocks.fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("https://sb.test/keyexchange/api/admin/invite-user")
    expect(init.body).not.toContain("password")
})

test("deleteUser appelle DELETE avec le user_id en query", async () => {
    await deleteUser("u9")
    expect(mocks.fetchMock).toHaveBeenCalledWith(
        "https://sb.test/keyexchange/api/admin/delete-user?user_id=u9",
        expect.objectContaining({ method: "DELETE" })
    )
})

test("les appels keyexchange jettent le corps d'erreur backend", async () => {
    mocks.fetchMock.mockResolvedValue({
        ok: false,
        text: () => Promise.resolve("quota dépassé"),
    })
    await expect(deleteUser("u9")).rejects.toThrow("quota dépassé")
})

test("les appels keyexchange jettent si non authentifié", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } })
    await expect(deleteUser("u9")).rejects.toThrow("Non authentifié")
    expect(mocks.fetchMock).not.toHaveBeenCalled()
})
