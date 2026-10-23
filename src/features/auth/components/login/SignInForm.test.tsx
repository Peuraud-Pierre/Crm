import { beforeEach, expect, rstest, test } from "@rstest/core"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { BrowserRouter } from "react-router"

const mocks = rstest.hoisted(() => ({
    getToken: rstest.fn(),
    reset: rstest.fn(),
}))

// Stub du captcha : même contrat que TurnstileField (ref.reset + ref.getToken),
// sans le script Cloudflare qui répondrait après la fin du test en jsdom.
rstest.mock("@/features/auth/components/TurnstileField", () => ({
    TurnstileField: ({
        ref,
    }: {
        ref?: { current: { reset: () => void; getToken: () => Promise<string> } | null }
    }) => {
        if (ref && typeof ref === "object") {
            ref.current = { reset: mocks.reset, getToken: mocks.getToken }
        }
        return null
    },
}))

import SignInForm from "./SignInForm"

beforeEach(() => {
    rstest.clearAllMocks()
    mocks.getToken.mockResolvedValue("captcha-token")
})

function renderForm(signIn: ReturnType<typeof rstest.fn>, email = "ana@exemple.fr") {
    return render(
        <BrowserRouter>
            <SignInForm
                signIn={signIn}
                email={email}
                onEmailChange={() => {}}
                emailPrefilled={!!email}
            />
        </BrowserRouter>
    )
}

function typePassword(value: string) {
    fireEvent.change(screen.getByLabelText("Mot de passe"), { target: { value } })
}

function clickSubmit() {
    fireEvent.click(screen.getByRole("button", { name: "Se connecter" }))
}

test("waits for the captcha token, then signs in with it", async () => {
    const signIn = rstest.fn().mockResolvedValue({ user: { id: "u1" } })
    renderForm(signIn)

    typePassword("secret")
    clickSubmit()

    await waitFor(() =>
        expect(signIn).toHaveBeenCalledWith("ana@exemple.fr", "secret", "captcha-token")
    )
    expect(mocks.getToken).toHaveBeenCalled()
    // Mot de passe accepté : le bouton reste occupé jusqu'à la redirection.
    expect(screen.getByRole("button", { name: /Connexion…/ })).toBeDisabled()
})

test("shows a wrong password inline, clears it and resets the captcha", async () => {
    const signIn = rstest.fn().mockResolvedValue({
        error: "Email ou mot de passe incorrect.",
        code: "invalid_credentials",
    })
    renderForm(signIn)

    typePassword("bad")
    clickSubmit()

    expect(await screen.findByRole("alert")).toHaveTextContent(
        "Email ou mot de passe incorrect."
    )
    expect(screen.getByLabelText("Mot de passe")).toHaveValue("")
    expect(mocks.reset).toHaveBeenCalled()
})

test("keeps the password on a network error", async () => {
    const signIn = rstest.fn().mockResolvedValue({
        error: "Connexion impossible. Vérifiez votre réseau et réessayez.",
        code: "network",
    })
    renderForm(signIn)

    typePassword("secret")
    clickSubmit()

    expect(await screen.findByRole("alert")).toHaveTextContent("Connexion impossible.")
    expect(screen.getByLabelText("Mot de passe")).toHaveValue("secret")
})

test("reports a captcha that never answers instead of spinning", async () => {
    mocks.getToken.mockRejectedValue(new Error("timeout"))
    const signIn = rstest.fn()
    renderForm(signIn)

    typePassword("secret")
    clickSubmit()

    expect(await screen.findByRole("alert")).toHaveTextContent(
        "La vérification de sécurité n'a pas abouti."
    )
    expect(signIn).not.toHaveBeenCalled()
})

test("asks for both fields before contacting the server", () => {
    renderForm(rstest.fn())

    clickSubmit()

    expect(screen.getByRole("alert")).toHaveTextContent(
        "Renseignez votre email et votre mot de passe."
    )
    expect(mocks.getToken).not.toHaveBeenCalled()
})

test("passes the typed email to the forgot-password link", () => {
    renderForm(rstest.fn())

    expect(
        screen.getByRole("link", { name: "Mot de passe oublié ?" })
    ).toHaveAttribute("href", "/forgot-password?email=ana%40exemple.fr")
})
