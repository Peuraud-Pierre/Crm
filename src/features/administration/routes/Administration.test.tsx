import { beforeEach, expect, rstest, test } from "@rstest/core"
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router"

const mocks = rstest.hoisted(() => {
    const hasPermission = rstest.fn()
    const useAuth = rstest.fn(() => ({ hasPermission }))
    return { hasPermission, useAuth }
})

rstest.mock("@/features/auth/hooks/useAuth/AuthProvider", () => ({
    useAuth: mocks.useAuth,
}))

// Ces tests portent sur la VISIBILITÉ des onglets selon les permissions, pas sur
// les données. Sans ces mocks, useAssignmentCounts et usePermissions lancent un
// refetch au montage : la promesse se résout après la fin de ces tests
// synchrones et leurs setState tombent hors act() — avec isolate:false
// (rstest.config.ts), la mise à jour retombe alors dans le fichier suivant.
rstest.mock("../hooks/data/useAssignmentCounts", () => ({
    // eslint-disable-next-line react-x/no-unnecessary-use-prefix -- nom du hook mocké
    useAssignmentCounts: () => ({
        byRole: {},
        byService: {},
        loading: false,
        refetch: rstest.fn(),
    }),
}))

rstest.mock("../hooks/data/usePermissions", () => ({
    // eslint-disable-next-line react-x/no-unnecessary-use-prefix -- nom du hook mocké
    usePermissions: () => ({
        permissions: [],
        assignments: [],
        loading: false,
        refetch: rstest.fn(),
        assignToEntity: rstest.fn(),
    }),
}))

import Administration from "./Administration"

function renderAt(path: string) {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path="/administration/:tab?" element={<Administration />} />
            </Routes>
        </MemoryRouter>
    )
}

const grant = (...codes: string[]) => {
    mocks.hasPermission.mockImplementation((code: string) =>
        codes.includes(code)
    )
}

beforeEach(() => {
    rstest.clearAllMocks()
})

test("tous les droits : les 4 onglets sont visibles", () => {
    grant("users.view", "roles_services.view")
    renderAt("/administration")

    expect(screen.getByRole("tab", { name: /utilisateurs/i })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /rôles/i })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /services/i })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /permissions/i })).toBeInTheDocument()
})

test("users.view seul : onglets rôles/services/permissions absents du DOM", () => {
    grant("users.view")
    renderAt("/administration")

    expect(screen.getByRole("tab", { name: /utilisateurs/i })).toBeInTheDocument()
    expect(screen.queryByRole("tab", { name: /rôles/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("tab", { name: /services/i })).not.toBeInTheDocument()
    expect(
        screen.queryByRole("tab", { name: /permissions/i })
    ).not.toBeInTheDocument()
})

test("roles_services.view seul : onglet utilisateurs absent, atterrit sur Rôles", () => {
    grant("roles_services.view")
    renderAt("/administration")

    expect(
        screen.queryByRole("tab", { name: /utilisateurs/i })
    ).not.toBeInTheDocument()
    expect(
        screen.getByRole("tab", { name: /rôles/i })
    ).toHaveAttribute("aria-selected", "true")
})

test("slug non autorisé : redirigé vers le premier onglet visible", () => {
    grant("users.view")
    renderAt("/administration/roles")

    expect(
        screen.getByRole("tab", { name: /utilisateurs/i })
    ).toHaveAttribute("aria-selected", "true")
})

test("aucun droit : rien n'est rendu (défense en profondeur)", () => {
    grant()
    const { container } = renderAt("/administration")
    expect(container).toBeEmptyDOMElement()
})
