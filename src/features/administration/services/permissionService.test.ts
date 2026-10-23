import { beforeEach, expect, rstest, test } from "@rstest/core"

const mocks = rstest.hoisted(() => {
    const results = new Map<string, unknown>()

    const from = rstest.fn((table: string) => {
        const builder: Record<string, unknown> = {}
        for (const m of ["select", "order", "insert", "delete", "eq"]) {
            builder[m] = rstest.fn(() => builder)
        }
        builder.then = (resolve: (v: unknown) => void) =>
            resolve(results.get(table) ?? { data: null, error: null })
        return builder
    })

    return { results, from }
})

rstest.mock("@/integrations/supabase/client", () => ({
    supabase: { from: mocks.from },
}))

import {
    listPermissionAssignments,
    listUserPermissions,
} from "./permissionService"

beforeEach(() => {
    rstest.clearAllMocks()
    mocks.results.clear()
})

test("listUserPermissions unit les codes hérités du rôle et du service", async () => {
    mocks.results.set("users_permissions", {
        data: [
            {
                permission: {
                    id: "p3",
                    code: "extra.perm",
                    label: "Extra",
                    category: null,
                },
            },
            { permission: null },
        ],
        error: null,
    })
    mocks.results.set("roles_permissions", {
        data: [
            { permission: { code: "users.view" } },
            { permission: { code: "common.perm" } },
        ],
        error: null,
    })
    mocks.results.set("services_permissions", {
        data: [
            { permission: { code: "common.perm" } },
            { permission: { code: "stock.view" } },
        ],
        error: null,
    })

    const result = await listUserPermissions("u1", "r1", "s1")

    expect(result.inheritedCodes).toEqual(
        new Set(["users.view", "common.perm", "stock.view"])
    )
    expect(result.individual).toEqual([
        { id: "p3", code: "extra.perm", label: "Extra", category: null },
    ])
})

test("listUserPermissions n'interroge pas rôle/service absents", async () => {
    mocks.results.set("users_permissions", { data: [], error: null })

    const result = await listUserPermissions("u1", null, null)

    expect(result.inheritedCodes.size).toBe(0)
    const tables = mocks.from.mock.calls.map((c: unknown[]) => c[0])
    expect(tables).toEqual(["users_permissions"])
})

test("listPermissionAssignments agrège rôles, services et compteur utilisateurs", async () => {
    mocks.results.set("roles_permissions", {
        data: [
            { permission_id: "p1", holder: { id: "r1", nom: "Admin" } },
            { permission_id: "p1", holder: { id: "r2", nom: "Manager" } },
            { permission_id: "p2", holder: null },
        ],
        error: null,
    })
    mocks.results.set("services_permissions", {
        data: [{ permission_id: "p1", holder: { id: "s1", nom: "IT" } }],
        error: null,
    })
    mocks.results.set("users_permissions", {
        data: [{ permission_id: "p1" }, { permission_id: "p1" }, { permission_id: "p3" }],
        error: null,
    })

    const assignments = await listPermissionAssignments()

    const p1 = assignments.get("p1")
    expect(p1?.roles.map((r) => r.nom)).toEqual(["Admin", "Manager"])
    expect(p1?.services.map((s) => s.nom)).toEqual(["IT"])
    expect(p1?.userCount).toBe(2)
    expect(assignments.get("p3")?.userCount).toBe(1)
    expect(assignments.has("p2")).toBe(false)
})
