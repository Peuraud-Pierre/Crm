import { beforeEach, expect, rstest, test } from "@rstest/core"

const mocks = rstest.hoisted(() => {
    const state = {
        tableResult: { data: null, error: null } as unknown,
        uploadResult: { error: null } as unknown,
        publicUrl: "https://cdn.test/avatars/u1/1.png" as string | undefined,
    }
    const calls: { update?: unknown; upload?: unknown; password?: unknown } = {}

    const from = rstest.fn(() => {
        const builder: Record<string, unknown> = {}
        builder.eq = rstest.fn(() => builder)
        builder.select = rstest.fn(() => builder)
        builder.update = rstest.fn((row: unknown) => {
            calls.update = row
            return builder
        })
        builder.maybeSingle = rstest.fn(() =>
            Promise.resolve(state.tableResult)
        )
        builder.then = (resolve: (v: unknown) => void) =>
            resolve(state.tableResult)
        return builder
    })

    const upload = rstest.fn((path: string, file: unknown) => {
        calls.upload = { path, file }
        return Promise.resolve(state.uploadResult)
    })

    const updateUser = rstest.fn((payload: unknown) => {
        calls.password = payload
        return Promise.resolve({ error: null })
    })

    return { state, calls, from, upload, updateUser }
})

rstest.mock("@/integrations/supabase/client", () => ({
    supabase: {
        from: mocks.from,
        storage: { from: () => ({ upload: mocks.upload }) },
        auth: {
            updateUser: mocks.updateUser,
            getSession: rstest.fn(() =>
                Promise.resolve({ data: { session: { access_token: "jwt" } } })
            ),
        },
    },
}))

rstest.mock("@/shared/services/avatarService", () => ({
    getAvatarPublicUrl: rstest.fn(() => mocks.state.publicUrl),
}))

import {
    getAccessToken,
    updateProfileIdentity,
    updateUserPassword,
    uploadProfileAvatar,
} from "./profileService"

beforeEach(() => {
    rstest.clearAllMocks()
    mocks.state.tableResult = { data: null, error: null }
    mocks.state.uploadResult = { error: null }
    mocks.state.publicUrl = "https://cdn.test/avatars/u1/1.png"
})

test("getAccessToken renvoie le JWT de la session courante", async () => {
    await expect(getAccessToken()).resolves.toBe("jwt")
})

test("updateProfileIdentity écrit nom et téléphone", async () => {
    await updateProfileIdentity("u1", {
        full_name: "Ada Lovelace",
        phone: " 0600000000 ",
    })

    expect(mocks.calls.update).toEqual({
        full_name: "Ada Lovelace",
        phone: "0600000000",
    })
})

test("updateProfileIdentity écrit NULL pour un téléphone vide", async () => {
    await updateProfileIdentity("u1", { full_name: "Ada", phone: "   " })

    expect(mocks.calls.update).toEqual({ full_name: "Ada", phone: null })
})

test("updateProfileIdentity propage l'erreur Supabase", async () => {
    mocks.state.tableResult = { data: null, error: new Error("rls") }

    await expect(
        updateProfileIdentity("u1", { full_name: "Ada", phone: null })
    ).rejects.toThrow("rls")
})

test("uploadProfileAvatar téléverse puis enregistre l'URL publique", async () => {
    const file = new File(["x"], "photo.png", { type: "image/png" })

    const url = await uploadProfileAvatar("u1", file)

    expect(url).toBe("https://cdn.test/avatars/u1/1.png")
    expect(
        (mocks.calls.upload as { path: string }).path.startsWith("u1/")
    ).toBe(true)
    expect(mocks.calls.update).toEqual({
        avatar_url: "https://cdn.test/avatars/u1/1.png",
    })
})

test("uploadProfileAvatar échoue si l'URL publique est introuvable", async () => {
    mocks.state.publicUrl = undefined
    const file = new File(["x"], "photo.png", { type: "image/png" })

    await expect(uploadProfileAvatar("u1", file)).rejects.toThrow(
        "URL publique de l'avatar introuvable."
    )
})

test("updateUserPassword délègue à supabase.auth.updateUser", async () => {
    await updateUserPassword("nouveau-mot-de-passe")

    expect(mocks.calls.password).toEqual({ password: "nouveau-mot-de-passe" })
})
