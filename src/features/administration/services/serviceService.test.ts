import { beforeEach, expect, rstest, test } from "@rstest/core"

// Builder supabase chaînable : chaque méthode renvoie le builder, l'await
// final résout le résultat configuré pour la table (thenable).
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
    addServicePermissions,
    createService,
    listServices,
    renameService,
} from "./serviceService"

beforeEach(() => {
    rstest.clearAllMocks()
    mocks.results.clear()
    mocks.builders.clear()
})

test("listServices aplatit la jointure services_permissions en permissions[]", async () => {
    mocks.results.set("services", {
        data: [
            {
                id: "s1",
                nom: "IT",
                created_at: "2026-01-01",
                updated_at: "2026-01-02",
                services_permissions: [
                    {
                        permission: {
                            id: "p1",
                            code: "users.view",
                            label: "Voir",
                            category: "users",
                        },
                    },
                    { permission: null },
                ],
            },
            {
                id: "s2",
                nom: "Support",
                created_at: "2026-01-01",
                updated_at: "2026-01-02",
                services_permissions: [],
            },
        ],
        error: null,
    })

    const services = await listServices()

    // Une seule requête (pas de N+1)
    expect(mocks.from).toHaveBeenCalledTimes(1)
    expect(services).toHaveLength(2)
    expect(services[0].permissions).toEqual([
        { id: "p1", code: "users.view", label: "Voir", category: "users" },
    ])
    expect(services[1].permissions).toEqual([])
    expect(
        "services_permissions" in
            (services[0] as unknown as Record<string, unknown>)
    ).toBe(false)
})

test("listServices jette l'erreur supabase", async () => {
    mocks.results.set("services", { data: null, error: new Error("RLS") })
    await expect(listServices()).rejects.toThrow("RLS")
})

test("createService renvoie le service avec permissions vides", async () => {
    mocks.results.set("services", {
        data: {
            id: "s9",
            nom: "Nouveau",
            created_at: "2026-01-01",
            updated_at: "2026-01-01",
        },
        error: null,
    })

    const service = await createService("Nouveau")
    expect(service.permissions).toEqual([])
    expect(service.nom).toBe("Nouveau")
    expect(mocks.builders.get("services")?.insert).toHaveBeenCalledWith([
        { nom: "Nouveau" },
    ])
})

test("renameService jette si aucune ligne mise à jour (RLS silencieuse)", async () => {
    mocks.results.set("services", { data: [], error: null })
    await expect(renameService("s1", "X")).rejects.toThrow(
        "Aucune ligne mise à jour"
    )
})

test("addServicePermissions insère un batch de liaisons", async () => {
    mocks.results.set("services_permissions", { data: null, error: null })
    await addServicePermissions("s1", ["p1", "p2"])
    expect(
        mocks.builders.get("services_permissions")?.insert
    ).toHaveBeenCalledWith([
        { service_id: "s1", permission_id: "p1" },
        { service_id: "s1", permission_id: "p2" },
    ])
})
