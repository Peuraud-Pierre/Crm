import { beforeEach, expect, rstest, test } from "@rstest/core"
import { act, renderHook, waitFor } from "@testing-library/react"

const mocks = rstest.hoisted(() => ({
    listPermissions: rstest.fn(),
    listUserPermissions: rstest.fn(),
    addUserPermissions: rstest.fn(),
    removeUserPermission: rstest.fn(),
    toast: { error: rstest.fn(), success: rstest.fn() },
}))

rstest.mock("@/features/administration/services/permissionService", () => ({
    listPermissions: mocks.listPermissions,
    listUserPermissions: mocks.listUserPermissions,
    addUserPermissions: mocks.addUserPermissions,
    removeUserPermission: mocks.removeUserPermission,
}))

rstest.mock("sonner", () => ({ toast: mocks.toast }))

import { useUserPermissions } from "./useUserPermissions"
import { silenceExpectedLogs } from "@/shared/lib/testing"

// Ces tests provoquent volontairement des erreurs pour vérifier leur gestion :
// le log applicatif qui en résulte est attendu, pas un symptôme.
silenceExpectedLogs(
    "Erreur ajout permissions individuelles",
    "Erreur retrait permission individuelle"
)

const CATALOG = [
    { id: "p1", code: "users.view", label: "Voir users", category: "users" },
    { id: "p2", code: "stock.view", label: "Voir stock", category: "stock" },
    { id: "p3", code: "crm.view", label: "Voir CRM", category: "crm" },
    { id: "p4", code: "extra.perm", label: "Extra", category: null },
]

beforeEach(() => {
    rstest.clearAllMocks()
    mocks.listPermissions.mockResolvedValue(CATALOG)
    mocks.listUserPermissions.mockResolvedValue({
        // individual = [p2 (effective), p1 (redondante : déjà héritée du rôle)]
        individual: [CATALOG[1], CATALOG[0]],
        inheritedCodes: new Set(["users.view", "crm.view"]),
    })
})

test("dérive héritées / individuelles effectives / disponibles", async () => {
    const { result } = renderHook(() => useUserPermissions("u1", "r1", "s1"))

    await waitFor(() => {
        expect(result.current.allPermissions).toHaveLength(4)
    })

    // Héritées = p1 (users.view) + p3 (crm.view)
    expect(result.current.inheritedPerms.map((p) => p.id).sort()).toEqual([
        "p1",
        "p3",
    ])
    // Individuelles effectives = p2 seulement (p1 déjà héritée)
    expect(result.current.effectiveIndividualPerms.map((p) => p.id)).toEqual([
        "p2",
    ])
    // Disponibles = ni héritées ni individuelles → p4
    expect(result.current.availablePerms.map((p) => p.id)).toEqual(["p4"])
})

test("userId null désactive le chargement", async () => {
    const { result } = renderHook(() => useUserPermissions(null, null, null))
    expect(result.current.loading).toBe(false)
    expect(mocks.listUserPermissions).not.toHaveBeenCalled()
    expect(result.current.individualPerms).toEqual([])
})

test("addPermissions optimiste puis rollback en erreur", async () => {
    mocks.addUserPermissions.mockRejectedValue(new Error("RLS"))

    const { result } = renderHook(() => useUserPermissions("u1", "r1", "s1"))
    await waitFor(() => {
        expect(result.current.allPermissions).toHaveLength(4)
    })

    await act(async () => {
        const ok = await result.current.addPermissions([CATALOG[3]])
        expect(ok).toBe(false)
    })

    // Rollback : p4 ne reste pas dans les individuelles
    expect(
        result.current.individualPerms.some((p) => p.id === "p4")
    ).toBe(false)
    expect(mocks.toast.error).toHaveBeenCalled()
})

test("removePermission optimiste puis rollback en erreur", async () => {
    mocks.removeUserPermission.mockRejectedValue(new Error("RLS"))

    const { result } = renderHook(() => useUserPermissions("u1", "r1", "s1"))
    await waitFor(() => {
        expect(result.current.individualPerms).toHaveLength(2)
    })

    await act(async () => {
        const ok = await result.current.removePermission("p2")
        expect(ok).toBe(false)
    })

    expect(
        result.current.individualPerms.some((p) => p.id === "p2")
    ).toBe(true)
})

test("addPermissions envoie les ids au service en succès", async () => {
    mocks.addUserPermissions.mockResolvedValue(undefined)

    const { result } = renderHook(() => useUserPermissions("u1", "r1", "s1"))
    await waitFor(() => {
        expect(result.current.allPermissions).toHaveLength(4)
    })

    await act(async () => {
        const ok = await result.current.addPermissions([CATALOG[3]])
        expect(ok).toBe(true)
    })

    expect(mocks.addUserPermissions).toHaveBeenCalledWith("u1", ["p4"])
    expect(
        result.current.individualPerms.some((p) => p.id === "p4")
    ).toBe(true)
})
