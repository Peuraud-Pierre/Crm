import { beforeEach, expect, rstest, test } from "@rstest/core"
import { act, renderHook, waitFor } from "@testing-library/react"

const mocks = rstest.hoisted(() => ({
    listPermissions: rstest.fn(),
    listPermissionAssignments: rstest.fn(),
    addRolePermissions: rstest.fn(),
    removeRolePermission: rstest.fn(),
    addServicePermissions: rstest.fn(),
    removeServicePermission: rstest.fn(),
    toast: { success: rstest.fn(), error: rstest.fn() },
}))

rstest.mock("sonner", () => ({ toast: mocks.toast }))
rstest.mock("../../services/permissionService", () => ({
    listPermissions: mocks.listPermissions,
    listPermissionAssignments: mocks.listPermissionAssignments,
}))
rstest.mock("../../services/roleService", () => ({
    addRolePermissions: mocks.addRolePermissions,
    removeRolePermission: mocks.removeRolePermission,
}))
rstest.mock("../../services/serviceService", () => ({
    addServicePermissions: mocks.addServicePermissions,
    removeServicePermission: mocks.removeServicePermission,
}))

import { usePermissions } from "./usePermissions"

const PERM = { id: "p1", code: "users.view", label: "Voir", category: "users" }

beforeEach(() => {
    rstest.clearAllMocks()
    mocks.listPermissions.mockResolvedValue([PERM])
    mocks.listPermissionAssignments.mockResolvedValue(new Map())
    mocks.addRolePermissions.mockResolvedValue(undefined)
    mocks.removeRolePermission.mockResolvedValue(undefined)
    mocks.addServicePermissions.mockResolvedValue(undefined)
    mocks.removeServicePermission.mockResolvedValue(undefined)
})

test("assignToEntity délègue au bon service puis recharge les détenteurs", async () => {
    const { result } = renderHook(() => usePermissions())
    await waitFor(() => expect(result.current.loading).toBe(false))
    const callsBefore = mocks.listPermissionAssignments.mock.calls.length

    let ok = false
    await act(async () => {
        ok = await result.current.assignToEntity(
            "p1",
            { kind: "role", id: "r1" },
            true
        )
    })
    expect(ok).toBe(true)
    expect(mocks.addRolePermissions).toHaveBeenCalledWith("r1", ["p1"])

    await act(async () => {
        await result.current.assignToEntity(
            "p1",
            { kind: "service", id: "s1" },
            false
        )
    })
    expect(mocks.removeServicePermission).toHaveBeenCalledWith("s1", "p1")
    expect(mocks.listPermissionAssignments.mock.calls.length).toBe(
        callsBefore + 2
    )
})

test("assignToEntity renvoie false et toaste en cas d'échec, sans refetch", async () => {
    const { result } = renderHook(() => usePermissions())
    await waitFor(() => expect(result.current.loading).toBe(false))
    const callsBefore = mocks.listPermissionAssignments.mock.calls.length

    const consoleError = console.error
    console.error = () => {}
    mocks.removeRolePermission.mockRejectedValue(new Error("RLS"))

    let ok = true
    await act(async () => {
        ok = await result.current.assignToEntity(
            "p1",
            { kind: "role", id: "r1" },
            false
        )
    })
    expect(ok).toBe(false)
    expect(mocks.toast.error).toHaveBeenCalled()
    expect(mocks.listPermissionAssignments.mock.calls.length).toBe(callsBefore)

    console.error = consoleError
})
