import { expect, rstest, test } from "@rstest/core"
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router"

const mocks = rstest.hoisted(() => ({
    hasPermission: rstest.fn(() => false),
    user: null as { user_id: string } | null,
}))

rstest.mock("@/shared/lib/errorLogger", () => ({
    initErrorLogger: rstest.fn(),
    resetErrorLogger: rstest.fn(),
    errorLogger: { error: rstest.fn(), warn: rstest.fn(), info: rstest.fn() },
}))

rstest.mock("@/features/auth/hooks/useAuth/AuthProvider", () => ({
    // eslint-disable-next-line react-x/no-unnecessary-use-prefix -- mock de useAuth
    useAuth: () => ({
        user: mocks.user,
        hasPermission: mocks.hasPermission,
    }),
}))

rstest.mock("@/features/announcements", () => ({
    AnnouncementsAdmin: () => <div>AnnouncementsAdmin</div>,
}))

rstest.mock("@/features/changelog", () => ({
    ChangelogAdmin: () => <div>ChangelogAdmin</div>,
    ChangelogProvider: ({ children }: { children: React.ReactNode }) => (
        <>{children}</>
    ),
}))

rstest.mock("@/features/maintenance", () => ({
    MaintenanceAdmin: () => <div>MaintenanceAdmin</div>,
}))

rstest.mock("@/features/dashboard", () => ({
    DashboardTemplatesAdmin: () => <div>DashboardTemplatesAdmin</div>,
}))

rstest.mock("../components/GenTypes/GenTypes", () => ({
    GenTypes: () => <div>GenTypes</div>,
}))

import Manager from "./Manager"

/** Monte la console sur la route à onglets, comme le fait le routeur réel. */
function renderAt(path: string) {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path="/manager/:tab?" element={<Manager />} />
            </Routes>
        </MemoryRouter>
    )
}

test("invite à se connecter quand l'utilisateur est absent", () => {
    mocks.user = null
    mocks.hasPermission.mockReturnValue(false)

    renderAt("/manager")

    expect(
        screen.getByText(
            "Veuillez vous connecter pour accéder au panneau Manager."
        )
    ).toBeInTheDocument()
})

test("n'affiche que les onglets autorisés", () => {
    mocks.user = { user_id: "u1" }
    mocks.hasPermission.mockImplementation(
        (code: string) => code === "manager.annonce"
    )

    renderAt("/manager")

    expect(screen.getByRole("tab", { name: "Annonces" })).toBeInTheDocument()
    expect(screen.queryByRole("tab", { name: "Changelog" })).toBeNull()
    expect(screen.queryByRole("tab", { name: "Maintenance" })).toBeNull()
})

test("retombe sur le premier onglet VISIBLE, pas sur un slug figé", () => {
    // L'ancienne version démarrait sur « changelog » en dur : un
    // utilisateur ne détenant que manager.annonce arrivait sur une page
    // vide.
    mocks.user = { user_id: "u1" }
    mocks.hasPermission.mockImplementation(
        (code: string) => code === "manager.annonce"
    )

    renderAt("/manager")

    expect(screen.getByText("AnnouncementsAdmin")).toBeInTheDocument()
})

test("ouvre directement l'onglet nommé dans l'URL", () => {
    mocks.user = { user_id: "u1" }
    mocks.hasPermission.mockReturnValue(true)

    renderAt("/manager/maintenance")

    expect(screen.getByText("MaintenanceAdmin")).toBeInTheDocument()
})

test("signale l'absence totale d'accès plutôt qu'une page vide", () => {
    mocks.user = { user_id: "u1" }
    mocks.hasPermission.mockReturnValue(false)

    renderAt("/manager")

    expect(
        screen.getByText("Vous n'avez accès à aucune section de la console.")
    ).toBeInTheDocument()
})
