import { beforeEach, expect, rstest, test } from "@rstest/core"
import { renderHook, waitFor } from "@testing-library/react"

const mocks = rstest.hoisted(() => ({
    profilesOrder: rstest.fn(),
    channel: rstest.fn(),
    removeChannel: rstest.fn(),
    toast: {
        success: rstest.fn(),
        error: rstest.fn(),
    },
}))

rstest.mock("sonner", () => ({
    toast: mocks.toast,
}))

rstest.mock("@/integrations/supabase/client", () => ({
    supabase: {
        from: () => ({
            select: () => ({
                // listProfilesDirectory filtre les profils archivés avant order.
                is: () => ({ order: mocks.profilesOrder }),
            }),
        }),
        channel: mocks.channel,
        removeChannel: mocks.removeChannel,
    },
}))

import { ProfilesProvider, useProfilesCtx } from "./ProfilesProvider"

beforeEach(() => {
    rstest.clearAllMocks()
    mocks.profilesOrder.mockResolvedValue({
        data: [
            {
                id: "u1",
                user_id: "u1",
                email: "alice@example.com",
                full_name: "Alice",
                status: "active",
                created_at: "2026-01-01",
                updated_at: "2026-01-01",
                role: { id: "r1", nom: "Admin" },
                service: { id: "s1", nom: "Tech" },
            },
        ],
        error: null,
    })
    mocks.channel.mockReturnValue({
        on: () => ({ subscribe: () => ({}) }),
        subscribe: () => ({}),
    })
})

test("charge l'annuaire des profils au montage", async () => {
    const { result } = renderHook(() => useProfilesCtx(), {
        wrapper: ProfilesProvider,
    })

    await waitFor(() => {
        expect(result.current.loading).toBe(false)
        expect(result.current.profiles).toHaveLength(1)
    })
    expect(result.current.profiles[0]?.service?.nom).toBe("Tech")
})

test("normalise une jointure renvoyée en tableau", async () => {
    mocks.profilesOrder.mockResolvedValue({
        data: [
            {
                id: "u2",
                user_id: "u2",
                email: "bob@example.com",
                full_name: "Bob",
                status: "pending",
                created_at: "2026-01-01",
                updated_at: "2026-01-01",
                role: [{ id: "r2", nom: "Employé" }],
                service: null,
            },
        ],
        error: null,
    })

    const { result } = renderHook(() => useProfilesCtx(), {
        wrapper: ProfilesProvider,
    })

    await waitFor(() => {
        expect(result.current.profiles).toHaveLength(1)
    })
    expect(result.current.profiles[0]?.role?.nom).toBe("Employé")
    expect(result.current.profiles[0]?.service).toBeNull()
})

test("signale l'erreur de chargement par un toast", async () => {
    mocks.profilesOrder.mockResolvedValue({
        data: null,
        error: new Error("RLS"),
    })

    const consoleError = console.error
    console.error = () => {}

    const { result } = renderHook(() => useProfilesCtx(), {
        wrapper: ProfilesProvider,
    })

    await waitFor(() => {
        expect(result.current.loading).toBe(false)
    })
    expect(mocks.toast.error).toHaveBeenCalled()
    expect(result.current.profiles).toHaveLength(0)

    console.error = consoleError
})
