import { beforeEach, expect, rstest, test } from "@rstest/core"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const mocks = rstest.hoisted(() => ({
    updateUserPassword: rstest.fn(),
    toast: { success: rstest.fn(), error: rstest.fn() },
}))

rstest.mock("sonner", () => ({ toast: mocks.toast }))
rstest.mock("@/features/profile/services/profileService", () => ({
    updateUserPassword: mocks.updateUserPassword,
}))

import { PasswordForm } from "./PasswordForm"
import { silenceExpectedLogs } from "@/shared/lib/testing"

// Ces tests provoquent volontairement des erreurs pour vérifier leur gestion :
// le log applicatif qui en résulte est attendu, pas un symptôme.
silenceExpectedLogs("[PasswordForm]")

const VALID = "Motdepasse1!"

beforeEach(() => {
    rstest.clearAllMocks()
    mocks.updateUserPassword.mockResolvedValue(undefined)
})

test("deux mots de passe divergents n'appellent pas Supabase", async () => {
    const user = userEvent.setup()
    render(<PasswordForm />)

    await user.type(screen.getByLabelText("Nouveau mot de passe"), VALID)
    await user.type(
        screen.getByLabelText("Confirmer le mot de passe"),
        "Autrechose1!"
    )

    expect(screen.getByRole("alert")).toHaveTextContent(
        "Les deux mots de passe ne correspondent pas."
    )
    expect(
        screen.getByRole("button", { name: "Modifier le mot de passe" })
    ).toBeDisabled()
    expect(mocks.updateUserPassword).not.toHaveBeenCalled()
})

test("des mots de passe identiques déclenchent la mise à jour puis vident le formulaire", async () => {
    const user = userEvent.setup()
    render(<PasswordForm />)

    const newPassword = screen.getByLabelText("Nouveau mot de passe")
    const confirmPassword = screen.getByLabelText("Confirmer le mot de passe")
    await user.type(newPassword, VALID)
    await user.type(confirmPassword, VALID)
    await user.click(
        screen.getByRole("button", { name: "Modifier le mot de passe" })
    )

    await waitFor(() =>
        expect(mocks.updateUserPassword).toHaveBeenCalledWith(VALID)
    )
    expect(mocks.toast.success).toHaveBeenCalled()
    await waitFor(() => expect(newPassword).toHaveValue(""))
    expect(confirmPassword).toHaveValue("")
})

test("un échec de mise à jour conserve la saisie et signale l'erreur", async () => {
    mocks.updateUserPassword.mockRejectedValue(new Error("trop court"))
    const user = userEvent.setup()
    render(<PasswordForm />)

    const newPassword = screen.getByLabelText("Nouveau mot de passe")
    await user.type(newPassword, VALID)
    await user.type(screen.getByLabelText("Confirmer le mot de passe"), VALID)
    await user.click(
        screen.getByRole("button", { name: "Modifier le mot de passe" })
    )

    await waitFor(() => expect(mocks.toast.error).toHaveBeenCalled())
    expect(newPassword).toHaveValue(VALID)
})

test("le bouton reste désactivé tant que la confirmation est vide", async () => {
    const user = userEvent.setup()
    render(<PasswordForm />)

    await user.type(screen.getByLabelText("Nouveau mot de passe"), VALID)

    expect(
        screen.getByRole("button", { name: "Modifier le mot de passe" })
    ).toBeDisabled()
})
