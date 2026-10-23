import { beforeEach, expect, rstest, test } from "@rstest/core"
import { renderHook, waitFor } from "@testing-library/react"

const mocks = rstest.hoisted(() => ({
    fetchMaintenanceWindows: rstest.fn(),
    insertMaintenanceWindow: rstest.fn(),
    updateMaintenanceWindow: rstest.fn(),
    deleteMaintenanceWindow: rstest.fn(),
    subscribeToTable: rstest.fn(() => () => {}),
    toast: { error: rstest.fn(), success: rstest.fn() },
}))

rstest.mock("../../services/maintenanceService", () => ({
    fetchMaintenanceWindows: mocks.fetchMaintenanceWindows,
    insertMaintenanceWindow: mocks.insertMaintenanceWindow,
    updateMaintenanceWindow: mocks.updateMaintenanceWindow,
    deleteMaintenanceWindow: mocks.deleteMaintenanceWindow,
}))

rstest.mock("@/shared/services/realtimeService", () => ({
    subscribeToTable: mocks.subscribeToTable,
}))

rstest.mock("sonner", () => ({ toast: mocks.toast }))

rstest.mock("@/features/auth/hooks/useAuth/AuthProvider", () => ({
    // eslint-disable-next-line react-x/no-unnecessary-use-prefix -- mock de useAuth
    useAuth: () => ({ user: { user_id: "user-1" } }),
}))

import { useMaintenance } from "./useMaintenance"

const globalWindow = {
    id: "w-global",
    scope: "global",
    feature_key: null,
    active: false,
    starts_at: "2026-09-01T10:00:00.000Z",
    ends_at: null,
    message: null,
    created_by: null,
    created_at: "2026-08-24T10:00:00.000Z",
    updated_at: "2026-08-24T10:00:00.000Z",
}

const stockWindow = {
    ...globalWindow,
    id: "w-stock",
    scope: "feature",
    feature_key: "stock",
    active: true,
}

beforeEach(() => {
    rstest.clearAllMocks()
    mocks.fetchMaintenanceWindows.mockResolvedValue([])
    mocks.subscribeToTable.mockReturnValue(() => {})
})

test("range les fenêtres en globale et par feature", async () => {
    mocks.fetchMaintenanceWindows.mockResolvedValue([globalWindow, stockWindow])

    const { result } = renderHook(() => useMaintenance())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.state.global?.id).toBe("w-global")
    expect(result.current.state.byFeature.stock?.id).toBe("w-stock")
})

test("isFeatureDown ne vaut vrai que pour une feature réellement active", async () => {
    mocks.fetchMaintenanceWindows.mockResolvedValue([
        stockWindow,
        { ...stockWindow, id: "w-crm", feature_key: "crm", active: false },
    ])

    const { result } = renderHook(() => useMaintenance())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.isFeatureDown("stock")).toBe(true)
    // Fenêtre programmée mais pas activée : la feature reste accessible.
    expect(result.current.isFeatureDown("crm")).toBe(false)
    // Feature sans fenêtre, et absence de clé.
    expect(result.current.isFeatureDown("wiki")).toBe(false)
    expect(result.current.isFeatureDown(undefined)).toBe(false)
})

test("une maintenance globale n'entraîne aucune coupure par feature", async () => {
    mocks.fetchMaintenanceWindows.mockResolvedValue([
        { ...globalWindow, active: true },
    ])

    const { result } = renderHook(() => useMaintenance())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.isGlobalDown).toBe(true)
    expect(result.current.isFeatureDown("stock")).toBe(false)
})

test("s'abonne au Realtime de la table app_maintenance", async () => {
    renderHook(() => useMaintenance())

    await waitFor(() => expect(mocks.subscribeToTable).toHaveBeenCalledTimes(1))
    expect(mocks.subscribeToTable.mock.calls[0][1]).toBe("app_maintenance")
})

test("un échec de chargement est signalé à l'utilisateur", async () => {
    // L'ancien hook rangeait l'erreur dans un state que personne
    // n'affichait : une opération échouée passait pour un succès.
    mocks.fetchMaintenanceWindows.mockRejectedValue(new Error("boom"))
    const errSpy = rstest.spyOn(console, "error").mockImplementation(() => {})

    const { result } = renderHook(() => useMaintenance())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(mocks.toast.error).toHaveBeenCalledTimes(1)
    expect(errSpy).toHaveBeenCalledWith("[useMaintenance] refetch:", expect.any(Error))
    errSpy.mockRestore()
})

test("editWindow renvoie false et prévient quand l'écriture échoue", async () => {
    mocks.updateMaintenanceWindow.mockRejectedValue(new Error("rls"))
    const errSpy = rstest.spyOn(console, "error").mockImplementation(() => {})

    const { result } = renderHook(() => useMaintenance())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await expect(
        result.current.editWindow("w1", { active: true })
    ).resolves.toBe(false)
    expect(mocks.toast.error).toHaveBeenCalled()
    expect(errSpy).toHaveBeenCalledWith("[useMaintenance] editWindow:", expect.any(Error))
    errSpy.mockRestore()
})
