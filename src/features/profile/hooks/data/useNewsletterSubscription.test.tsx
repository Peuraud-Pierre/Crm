import { beforeEach, expect, rstest, test } from "@rstest/core"
import { act, renderHook, waitFor } from "@testing-library/react"

const mocks = rstest.hoisted(() => ({
    fetchNewsletterSubscription: rstest.fn(),
    subscribeToNewsletter: rstest.fn(),
    unsubscribeFromNewsletter: rstest.fn(),
    useAuth: rstest.fn(),
    toast: { success: rstest.fn(), error: rstest.fn() },
}))

rstest.mock("sonner", () => ({ toast: mocks.toast }))
rstest.mock("@/features/auth/hooks/useAuth/AuthProvider", () => ({
    useAuth: mocks.useAuth,
}))
rstest.mock("../../services/newsletterService", () => ({
    fetchNewsletterSubscription: mocks.fetchNewsletterSubscription,
    subscribeToNewsletter: mocks.subscribeToNewsletter,
    unsubscribeFromNewsletter: mocks.unsubscribeFromNewsletter,
}))

import { useNewsletterSubscription } from "./useNewsletterSubscription"

/** N'autorise que les colonnes listées (+ la permission d'accès générale). */
function authWithColumns(keys: string[]) {
    const hasPermission = (code: string) =>
        keys.some((key) => code === `stock.arrivage.newsletter.${key}`)

    mocks.useAuth.mockReturnValue({
        user: { user_id: "u1", email: "a@b.c", full_name: "Ada" },
        hasPermission,
    })
}

beforeEach(() => {
    rstest.clearAllMocks()
    authWithColumns(["status", "container_no"])
    mocks.fetchNewsletterSubscription.mockResolvedValue(null)
    mocks.subscribeToNewsletter.mockResolvedValue(undefined)
    mocks.unsubscribeFromNewsletter.mockResolvedValue(undefined)
})

test("ne propose que les colonnes autorisées, toutes cochées par défaut", async () => {
    const { result } = renderHook(() => useNewsletterSubscription())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.allowedColumns.map((c) => c.key)).toEqual([
        "status",
        "container_no",
    ])
    expect([...result.current.selected].sort()).toEqual([
        "container_no",
        "status",
    ])
})

test("ne lit l'abonnement qu'une fois (allowedColumns mémoïsé)", async () => {
    const { result, rerender } = renderHook(() => useNewsletterSubscription())
    await waitFor(() => expect(result.current.loading).toBe(false))

    rerender()
    rerender()

    expect(mocks.fetchNewsletterSubscription).toHaveBeenCalledTimes(1)
})

test("restaure la sélection en écartant les colonnes non permises", async () => {
    mocks.fetchNewsletterSubscription.mockResolvedValue({
        active: true,
        visible_columns: ["status", "notes"],
    })

    const { result } = renderHook(() => useNewsletterSubscription())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.isSubscribed).toBe(true)
    expect([...result.current.selected]).toEqual(["status"])
})

test("subscribe refuse une sélection vide sans appeler l'API", async () => {
    const { result } = renderHook(() => useNewsletterSubscription())
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
        result.current.toggleColumn("status")
        result.current.toggleColumn("container_no")
    })

    let ok = true
    await act(async () => {
        ok = await result.current.subscribe("ARV-1")
    })

    expect(ok).toBe(false)
    expect(mocks.subscribeToNewsletter).not.toHaveBeenCalled()
    expect(mocks.toast.error).toHaveBeenCalledWith(
        "Sélectionnez au moins une colonne."
    )
})

test("subscribe envoie les colonnes cochées et le code d'invitation", async () => {
    const { result } = renderHook(() => useNewsletterSubscription())
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
        result.current.toggleColumn("container_no")
    })
    await act(async () => {
        await result.current.subscribe("ARV-1")
    })

    expect(mocks.subscribeToNewsletter).toHaveBeenCalledWith({
        email: "a@b.c",
        full_name: "Ada",
        visible_columns: ["status"],
        invitation_code: "ARV-1",
    })
    expect(result.current.isSubscribed).toBe(true)
})

test("unsubscribe repasse l'état à non abonné", async () => {
    mocks.fetchNewsletterSubscription.mockResolvedValue({
        active: true,
        visible_columns: ["status"],
    })
    const { result } = renderHook(() => useNewsletterSubscription())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
        await result.current.unsubscribe()
    })

    expect(result.current.isSubscribed).toBe(false)
})
