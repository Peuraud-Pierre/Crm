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
            "single",
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

    const upload = rstest.fn(async () => ({ error: null }))
    const remove = rstest.fn(async () => ({ error: null }))
    const getPublicUrl = rstest.fn((path: string) => ({
        data: { publicUrl: `https://cdn.test/annonces/${path}` },
    }))
    const storageFrom = rstest.fn(() => ({ upload, remove, getPublicUrl }))

    return { results, builders, from, upload, remove, storageFrom }
})

rstest.mock("@/integrations/supabase/client", () => ({
    supabase: { from: mocks.from, storage: { from: mocks.storageFrom } },
}))

import {
    fetchAnnouncements,
    resolveAnnouncementImage,
    setAnnouncementArchived,
    uploadAnnouncementImage,
} from "./announcementService"

beforeEach(() => {
    rstest.clearAllMocks()
    mocks.results.clear()
    mocks.builders.clear()
})

test("fetchAnnouncements trie les épinglées d'abord côté serveur", async () => {
    mocks.results.set("annonce", { data: [], error: null })

    await fetchAnnouncements()

    const order = mocks.builders.get("annonce")?.order
    expect(order?.mock.calls[0]).toEqual(["pinned", { ascending: false }])
    expect(order?.mock.calls[1]).toEqual(["start_date", { ascending: false }])
})

test("fetchAnnouncements propage l'erreur Supabase", async () => {
    mocks.results.set("annonce", { data: null, error: { message: "nope" } })

    await expect(fetchAnnouncements()).rejects.toEqual({ message: "nope" })
})

test("setAnnouncementArchived pose puis efface archived_at", async () => {
    mocks.results.set("annonce", { data: null, error: null })
    await setAnnouncementArchived("a1", true)
    const archived = mocks.builders.get("annonce")?.update.mock.calls[0][0] as {
        archived_at: string | null
    }
    expect(typeof archived.archived_at).toBe("string")

    mocks.builders.clear()
    await setAnnouncementArchived("a1", false)
    expect(mocks.builders.get("annonce")?.update.mock.calls[0][0]).toEqual({
        archived_at: null,
    })
})

test("resolveAnnouncementImage rend telle quelle une data-URL héritée", () => {
    // Les annonces d'avant le passage au stockage objet portent encore
    // leur image en base64 : elles doivent continuer à s'afficher.
    const dataUrl = "data:image/png;base64,AAAA"
    expect(resolveAnnouncementImage(dataUrl)).toBe(dataUrl)
    expect(mocks.storageFrom).not.toHaveBeenCalled()
})

test("resolveAnnouncementImage résout un chemin dans le bucket", () => {
    expect(resolveAnnouncementImage("123-abc.jpg")).toBe(
        "https://cdn.test/annonces/123-abc.jpg"
    )
})

test("resolveAnnouncementImage tolère l'absence d'image", () => {
    expect(resolveAnnouncementImage(null)).toBeNull()
    expect(resolveAnnouncementImage(undefined)).toBeNull()
    expect(resolveAnnouncementImage("")).toBeNull()
})

test("uploadAnnouncementImage refuse un fichier trop lourd", async () => {
    // L'ancien formulaire n'imposait aucune limite et encodait le fichier
    // en base64 dans la colonne, chargée par tous les utilisateurs.
    const big = new File(["x"], "big.jpg", { type: "image/jpeg" })
    Object.defineProperty(big, "size", { value: 5 * 1024 * 1024 })

    await expect(uploadAnnouncementImage(big)).rejects.toThrow(/trop lourde/)
    expect(mocks.upload).not.toHaveBeenCalled()
})

test("uploadAnnouncementImage renvoie le chemin téléversé", async () => {
    const file = new File(["x"], "photo.PNG", { type: "image/png" })
    Object.defineProperty(file, "size", { value: 1024 })

    const path = await uploadAnnouncementImage(file)

    expect(path).toMatch(/^\d+-[0-9a-f-]+\.png$/)
    expect(mocks.upload).toHaveBeenCalledTimes(1)
})
