import { beforeEach, expect, rstest, test } from "@rstest/core"

// Builder supabase chaînable : chaque méthode renvoie le builder, l'await
// final résout le résultat configuré pour la table (thenable).
// Modèle : src/features/administration/services/roleService.test.ts
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

    return { results, builders, from }
})

rstest.mock("@/integrations/supabase/client", () => ({
    supabase: { from: mocks.from },
}))

import {
    deleteMaintenanceWindow,
    fetchMaintenanceWindows,
    insertMaintenanceWindow,
    updateMaintenanceWindow,
} from "./maintenanceService"

beforeEach(() => {
    rstest.clearAllMocks()
    mocks.results.clear()
    mocks.builders.clear()
})

test("fetchMaintenanceWindows renvoie un tableau vide quand la table est vide", async () => {
    mocks.results.set("app_maintenance", { data: null, error: null })

    await expect(fetchMaintenanceWindows()).resolves.toEqual([])
})

test("fetchMaintenanceWindows propage l'erreur Supabase", async () => {
    mocks.results.set("app_maintenance", {
        data: null,
        error: { message: "boom" },
    })

    await expect(fetchMaintenanceWindows()).rejects.toEqual({ message: "boom" })
})

test("insertMaintenanceWindow force feature_key à null en portée globale", async () => {
    mocks.results.set("app_maintenance", {
        data: { id: "w1", scope: "global" },
        error: null,
    })

    await insertMaintenanceWindow({
        scope: "global",
        starts_at: "2026-09-01T10:00:00.000Z",
        ends_at: null,
        message: null,
    })

    const insert = mocks.builders.get("app_maintenance")?.insert
    expect(insert).toHaveBeenCalledTimes(1)
    expect(insert?.mock.calls[0][0]).toMatchObject({
        scope: "global",
        feature_key: null,
        active: false,
    })
})

test("insertMaintenanceWindow conserve feature_key en portée ciblée", async () => {
    mocks.results.set("app_maintenance", {
        data: { id: "w2", scope: "feature" },
        error: null,
    })

    await insertMaintenanceWindow({
        scope: "feature",
        feature_key: "stock",
        starts_at: "2026-09-01T10:00:00.000Z",
        ends_at: null,
        message: "Migration",
    })

    const insert = mocks.builders.get("app_maintenance")?.insert
    expect(insert?.mock.calls[0][0]).toMatchObject({
        scope: "feature",
        feature_key: "stock",
        message: "Migration",
    })
})

test("updateMaintenanceWindow cible la ligne par son id", async () => {
    mocks.results.set("app_maintenance", {
        data: { id: "w1", active: true },
        error: null,
    })

    await updateMaintenanceWindow("w1", { active: true })

    const builder = mocks.builders.get("app_maintenance")
    expect(builder?.update.mock.calls[0][0]).toEqual({ active: true })
    expect(builder?.eq.mock.calls[0]).toEqual(["id", "w1"])
})

test("deleteMaintenanceWindow propage l'erreur Supabase", async () => {
    mocks.results.set("app_maintenance", {
        data: null,
        error: { message: "refusé par la RLS" },
    })

    await expect(deleteMaintenanceWindow("w1")).rejects.toEqual({
        message: "refusé par la RLS",
    })
})
