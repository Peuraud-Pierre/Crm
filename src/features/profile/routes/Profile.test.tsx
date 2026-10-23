import { beforeEach, expect, rstest, test } from "@rstest/core"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router"

const mocks = rstest.hoisted(() => ({
    useAuth: rstest.fn(),
}))

rstest.mock("@/features/auth/hooks/useAuth/AuthProvider", () => ({
    useAuth: mocks.useAuth,
}))

rstest.mock("../components/identity/IdentityPanel", () => ({
    IdentityPanel: () => <div>Panneau identité</div>,
}))

import Profile from "./Profile"

const USER = { user_id: "u1", full_name: "Ada", status: "active" }

function renderProfile() {
    return render(
        <MemoryRouter>
            <Profile />
        </MemoryRouter>
    )
}

beforeEach(() => {
    rstest.clearAllMocks()
    mocks.useAuth.mockReturnValue({ user: USER })
})

test("affiche un squelette tant que le profil n'est pas chargé", () => {
    mocks.useAuth.mockReturnValue({ user: null })

    renderProfile()

    expect(screen.queryByText("Mon profil")).not.toBeInTheDocument()
    expect(screen.queryByText("Panneau identité")).not.toBeInTheDocument()
})

test("rend l'identité, sans onglets", () => {
    renderProfile()

    expect(screen.getByText("Mon profil")).toBeInTheDocument()
    expect(screen.getByText("Panneau identité")).toBeInTheDocument()
    // Les réglages ont déménagé dans /settings : plus de barre d'onglets.
    expect(screen.queryAllByRole("tab")).toHaveLength(0)
})

test("propose un accès aux paramètres", () => {
    renderProfile()

    expect(screen.getByRole("link", { name: /Paramètres/ })).toHaveAttribute(
        "href",
        "/settings"
    )
})
