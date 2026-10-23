import { beforeEach, expect, rstest, test } from "@rstest/core"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const mocks = rstest.hoisted(() => ({
    saveIdentity: rstest.fn(),
    uploadAvatar: rstest.fn(),
    useProfileIdentity: rstest.fn(),
}))

rstest.mock("../../hooks/data/useProfileIdentity", () => ({
    useProfileIdentity: mocks.useProfileIdentity,
}))

import { IdentityForm } from "./IdentityForm"

const USER = {
    user_id: "u1",
    id: "u1",
    full_name: "Ada Lovelace",
    email: "ada@example.com",
    avatar_url: null,
} as never

beforeEach(() => {
    rstest.clearAllMocks()
    mocks.saveIdentity.mockResolvedValue(true)
    mocks.uploadAvatar.mockResolvedValue(true)
    mocks.useProfileIdentity.mockReturnValue({
        saving: false,
        uploading: false,
        saveIdentity: mocks.saveIdentity,
        uploadAvatar: mocks.uploadAvatar,
    })
})

test("pré-remplit le formulaire avec le profil courant", () => {
    render(<IdentityForm user={USER} phone="0600000000" />)

    expect(screen.getByLabelText("Nom complet")).toHaveValue("Ada Lovelace")
    expect(screen.getByLabelText("Téléphone")).toHaveValue("0600000000")
    expect(screen.getByLabelText("Email")).toBeDisabled()
})

test("un nom vide désactive l'enregistrement", async () => {
    const user = userEvent.setup()
    render(<IdentityForm user={USER} phone={null} />)

    await user.clear(screen.getByLabelText("Nom complet"))

    expect(screen.getByRole("button", { name: "Enregistrer" })).toBeDisabled()
    expect(mocks.saveIdentity).not.toHaveBeenCalled()
})

test("soumet le nom détouré et le téléphone saisi", async () => {
    const user = userEvent.setup()
    render(<IdentityForm user={USER} phone={null} />)

    const fullName = screen.getByLabelText("Nom complet")
    await user.clear(fullName)
    await user.type(fullName, "  Grace Hopper  ")
    await user.type(screen.getByLabelText("Téléphone"), "0700000000")
    await user.click(screen.getByRole("button", { name: "Enregistrer" }))

    await waitFor(() =>
        expect(mocks.saveIdentity).toHaveBeenCalledWith({
            full_name: "Grace Hopper",
            phone: "0700000000",
        })
    )
})

test("le choix d'une image délègue au hook d'upload", async () => {
    const user = userEvent.setup()
    render(<IdentityForm user={USER} phone={null} />)

    const file = new File(["x"], "photo.png", { type: "image/png" })
    await user.upload(
        screen.getByLabelText("Nouvelle photo de profil"),
        file
    )

    expect(mocks.uploadAvatar).toHaveBeenCalledWith(file)
})
