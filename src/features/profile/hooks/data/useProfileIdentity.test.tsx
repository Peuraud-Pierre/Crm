import { beforeEach, expect, rstest, test } from "@rstest/core"
import { act, renderHook } from "@testing-library/react"

const mocks = rstest.hoisted(() => ({
    updateProfileIdentity: rstest.fn(),
    uploadProfileAvatar: rstest.fn(),
    setUser: rstest.fn(),
    useAuth: rstest.fn(),
    toast: { success: rstest.fn(), error: rstest.fn() },
}))

rstest.mock("sonner", () => ({ toast: mocks.toast }))
rstest.mock("@/features/auth/hooks/useAuth/AuthProvider", () => ({
    useAuth: mocks.useAuth,
}))
rstest.mock("../../services/profileService", () => ({
    updateProfileIdentity: mocks.updateProfileIdentity,
    uploadProfileAvatar: mocks.uploadProfileAvatar,
}))

import { useProfileIdentity } from "./useProfileIdentity"
import { silenceExpectedLogs } from "@/shared/lib/testing"

// Ces tests provoquent volontairement des erreurs pour vérifier leur gestion :
// le log applicatif qui en résulte est attendu, pas un symptôme.
silenceExpectedLogs("[useProfileIdentity]")

beforeEach(() => {
    rstest.clearAllMocks()
    mocks.useAuth.mockReturnValue({
        user: { user_id: "u1", full_name: "Ada" },
        setUser: mocks.setUser,
    })
    mocks.updateProfileIdentity.mockResolvedValue(undefined)
    mocks.uploadProfileAvatar.mockResolvedValue("https://cdn.test/a.png")
})

test("saveIdentity écrit puis propage le nom dans le contexte d'auth", async () => {
    const { result } = renderHook(() => useProfileIdentity())

    let ok = false
    await act(async () => {
        ok = await result.current.saveIdentity({
            full_name: "Ada Lovelace",
            phone: "0600000000",
        })
    })

    expect(ok).toBe(true)
    expect(mocks.updateProfileIdentity).toHaveBeenCalledWith("u1", {
        full_name: "Ada Lovelace",
        phone: "0600000000",
    })
    expect(mocks.setUser).toHaveBeenCalled()

    // setUser reçoit un updater : on vérifie le profil qu'il produit.
    const updater = mocks.setUser.mock.calls[0][0] as (
        previous: unknown
    ) => { full_name: string }
    expect(updater({ user_id: "u1", full_name: "Ada" }).full_name).toBe(
        "Ada Lovelace"
    )
})

test("saveIdentity signale l'échec sans toucher au contexte", async () => {
    mocks.updateProfileIdentity.mockRejectedValue(new Error("rls"))
    const { result } = renderHook(() => useProfileIdentity())

    let ok = true
    await act(async () => {
        ok = await result.current.saveIdentity({
            full_name: "Ada",
            phone: null,
        })
    })

    expect(ok).toBe(false)
    expect(mocks.setUser).not.toHaveBeenCalled()
    expect(mocks.toast.error).toHaveBeenCalled()
})

test("uploadAvatar refuse un fichier qui n'est pas une image", async () => {
    const { result } = renderHook(() => useProfileIdentity())
    const file = new File(["x"], "doc.pdf", { type: "application/pdf" })

    let ok = true
    await act(async () => {
        ok = await result.current.uploadAvatar(file)
    })

    expect(ok).toBe(false)
    expect(mocks.uploadProfileAvatar).not.toHaveBeenCalled()
    expect(mocks.toast.error).toHaveBeenCalledWith(
        "Veuillez sélectionner une image."
    )
})

test("uploadAvatar propage la nouvelle URL dans le contexte", async () => {
    const { result } = renderHook(() => useProfileIdentity())
    const file = new File(["x"], "photo.png", { type: "image/png" })

    await act(async () => {
        await result.current.uploadAvatar(file)
    })

    const updater = mocks.setUser.mock.calls[0][0] as (
        previous: unknown
    ) => { avatar_url: string }
    expect(updater({ user_id: "u1" }).avatar_url).toBe("https://cdn.test/a.png")
})
