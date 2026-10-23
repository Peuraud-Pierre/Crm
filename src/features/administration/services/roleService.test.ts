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
    addRolePermissions,
    createRole,
    listRoles,
    renameRole,
} from "./roleService"

beforeEach(() => {
    rstest.clearAllMocks()
    mocks.results.clear()
    mocks.builders.clear()
})

test("listRoles aplatit la jointure roles_permissions en permissions[]", async () => {
    mocks.results.set("roles", {
        data: [
            {
                id: "r1",
                nom: "Admin",
                created_at: "2026-01-01",
                updated_at: "2026-01-02",
                roles_permissions: [
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
                id: "r2",
                nom: "Employé",
                created_at: "2026-01-01",
                updated_at: "2026-01-02",
                roles_permissions: [],
            },
        ],
        error: null,
    })

    const roles = await listRoles()

    // Une seule requête (pas de N+1)
    expect(mocks.from).toHaveBeenCalledTimes(1)
    expect(roles).toHaveLength(2)
    expect(roles[0].permissions).toEqual([
        { id: "p1", code: "users.view", label: "Voir", category: "users" },
    ])
    expect(roles[1].permissions).toEqual([])
    expect(
        "roles_permissions" in (roles[0] as unknown as Record<string, unknown>)
    ).toBe(false)
})

test("listRoles jette l'erreur supabase", async () => {
    mocks.results.set("roles", { data: null, error: new Error("RLS") })
    await expect(listRoles()).rejects.toThrow("RLS")
})

test("createRole renvoie le rôle avec permissions vides", async () => {
    mocks.results.set("roles", {
        data: {
            id: "r9",
            nom: "Nouveau",
            created_at: "2026-01-01",
            updated_at: "2026-01-01",
        },
        error: null,
    })

    const role = await createRole("Nouveau")
    expect(role.permissions).toEqual([])
    expect(role.nom).toBe("Nouveau")
    expect(mocks.builders.get("roles")?.insert).toHaveBeenCalledWith([
        { nom: "Nouveau" },
    ])
})

test("renameRole jette si aucune ligne mise à jour (RLS silencieuse)", async () => {
    mocks.results.set("roles", { data: [], error: null })
    await expect(renameRole("r1", "X")).rejects.toThrow(
        "Aucune ligne mise à jour"
    )
})

test("addRolePermissions insère un batch de liaisons", async () => {
    mocks.results.set("roles_permissions", { data: null, error: null })
    await addRolePermissions("r1", ["p1", "p2"])
    expect(mocks.builders.get("roles_permissions")?.insert).toHaveBeenCalledWith([
        { role_id: "r1", permission_id: "p1" },
        { role_id: "r1", permission_id: "p2" },
    ])
})
