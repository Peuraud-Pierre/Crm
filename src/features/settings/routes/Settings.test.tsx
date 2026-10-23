import { beforeEach, expect, rstest, test } from "@rstest/core"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router"

const mocks = rstest.hoisted(() => ({
    useAuth: rstest.fn(),
}))

rstest.mock("@/features/auth/hooks/useAuth/AuthProvider", () => ({
    useAuth: mocks.useAuth,
}))

rstest.mock("../components/security/SecuritySection", () => ({
    SecuritySection: () => <div>Section sécurité</div>,
}))
rstest.mock("../components/preferences/PreferencesSection", () => ({
    PreferencesSection: () => <div>Section préférences</div>,
}))
rstest.mock("../components/integrations/IntegrationsSection", () => ({
    IntegrationsSection: () => <div>Section intégrations</div>,
}))

import Settings from "./Settings"

const USER = { user_id: "u1", full_name: "Ada", status: "active" }

function LocationProbe() {
    const { pathname } = useLocation()
    return <span data-testid="pathname">{pathname}</span>
}

/** Rend la page sur l'URL demandée, avec la vraie signature de route. */
function renderAt(path: string) {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route
                    path="/settings/:section?"
                    element={
                        <>
                            <Settings />
                            <LocationProbe />
                        </>
                    }
                />
            </Routes>
        </MemoryRouter>
    )
}

beforeEach(() => {
    rstest.clearAllMocks()
    mocks.useAuth.mockReturnValue({
        user: USER,
        hasPermission: rstest.fn().mockReturnValue(true),
    })
})

test("sans slug, redirige vers la première section", async () => {
    renderAt("/settings")

    await waitFor(() =>
        expect(screen.getByText("Section sécurité")).toBeInTheDocument()
    )
    expect(screen.getByTestId("pathname")).toHaveTextContent(
        "/settings/securite"
    )
})

test("un slug inconnu retombe sur la première section sans planter", async () => {
    renderAt("/settings/nimportequoi")

    await waitFor(() =>
        expect(screen.getByText("Section sécurité")).toBeInTheDocument()
    )
})

test("un deep-link ouvre directement la section demandée", async () => {
    renderAt("/settings/preferences")

    await waitFor(() =>
        expect(screen.getByText("Section préférences")).toBeInTheDocument()
    )
})

test("le sommaire navigue vers la section choisie", async () => {
    const user = userEvent.setup()
    renderAt("/settings/securite")
    await waitFor(() =>
        expect(screen.getByText("Section sécurité")).toBeInTheDocument()
    )

    await user.click(screen.getByRole("button", { name: /Préférences/ }))

    expect(screen.getByTestId("pathname")).toHaveTextContent(
        "/settings/preferences"
    )
})

test("la section active est signalée pour l'accessibilité", async () => {
    renderAt("/settings/preferences")

    await waitFor(() =>
        expect(screen.getByText("Section préférences")).toBeInTheDocument()
    )
    expect(
        screen.getByRole("button", { name: /Préférences/ })
    ).toHaveAttribute("aria-current", "page")
})

test("la section Intégrations est absente sans la permission newsletter", async () => {
    mocks.useAuth.mockReturnValue({
        user: USER,
        hasPermission: rstest.fn().mockReturnValue(false),
    })

    renderAt("/settings/securite")

    await waitFor(() =>
        expect(screen.getByText("Section sécurité")).toBeInTheDocument()
    )
    expect(
        screen.queryByRole("button", { name: /Intégrations/ })
    ).not.toBeInTheDocument()
})

test("un slug non autorisé redirige vers une section visible", async () => {
    mocks.useAuth.mockReturnValue({
        user: USER,
        hasPermission: rstest.fn().mockReturnValue(false),
    })

    renderAt("/settings/integrations")

    await waitFor(() =>
        expect(screen.getByText("Section sécurité")).toBeInTheDocument()
    )
    expect(screen.getByTestId("pathname")).toHaveTextContent(
        "/settings/securite"
    )
})
