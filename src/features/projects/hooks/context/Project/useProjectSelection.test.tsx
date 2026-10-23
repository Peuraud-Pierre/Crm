import { act, renderHook, waitFor } from "@testing-library/react"
import { expect, test } from "@rstest/core"
import type { ReactNode } from "react"
import { MemoryRouter, Route, Routes, useLocation } from "react-router"

import { useProjectSelection } from "./useProjectSelection"
import type { UseProjectsReturn } from "@/features/projects/hooks/Projects/useProjects"
import type { AppUser } from "@/features/auth/hooks/useAuth"

const makeTeam = (overrides: Record<string, unknown>) => ({
    id: "team-1",
    status: "active",
    owner_id: "user-1",
    members: [],
    sprints: [],
    ...overrides,
})

const teams = [
    makeTeam({
        id: "team-1",
        owner_id: "user-1",
        sprints: [
            { id: "s2", start_date: "2025-02-01", status: "active", tasks: [] },
            { id: "s1", start_date: "2025-01-01", status: "active", tasks: [] },
        ],
    }),
    makeTeam({ id: "team-2", owner_id: "user-2" }),
]

// Dernière URL rendue, pour vérifier les navigations déclenchées par le hook.
let lastPath = ""

function LocationSpy() {
    const location = useLocation()
    lastPath = location.pathname + location.search
    return null
}

const wrapper = (initialPath: string) =>
    function Wrapper({ children }: { children: ReactNode }) {
        return (
            <MemoryRouter initialEntries={[initialPath]}>
                <LocationSpy />
                <Routes>
                    <Route
                        path="/projects/:projectId?/:view?/:taskId?"
                        element={children}
                    />
                </Routes>
            </MemoryRouter>
        )
    }

const renderSelection = (initialPath: string, projectApi?: Partial<UseProjectsReturn>) =>
    renderHook(
        () =>
            useProjectSelection(
                { teams, loading: false, ...projectApi } as unknown as UseProjectsReturn,
                { user_id: "user-1" } as unknown as AppUser
            ),
        { wrapper: wrapper(initialPath) }
    )

test("aucun projet sélectionné sur /projects (pas d'auto-sélection)", () => {
    const { result } = renderSelection("/projects")

    expect(result.current.selectedProjectId).toBe(null)
    expect(result.current.selectedProject).toBe(null)
    expect(result.current.activeTeams).toHaveLength(2)
})

test("le projet et le sprint sont lus depuis l'URL", () => {
    const { result } = renderSelection("/projects/team-1?sprint=s2")

    expect(result.current.selectedProjectId).toBe("team-1")
    expect(result.current.selectedSprintId).toBe("s2")
    expect(result.current.view).toBe("kanban")
})

test("sprint absent de l'URL → repli sur le premier sprint actif trié", () => {
    const { result } = renderSelection("/projects/team-1")

    expect(result.current.selectedSprintId).toBe("s1")
})

test("projet inconnu → redirection vers l'accueil", async () => {
    renderSelection("/projects/team-inconnu")

    await waitFor(() => {
        expect(lastPath).toBe("/projects")
    })
})

test("sprint inconnu → paramètre nettoyé", async () => {
    renderSelection("/projects/team-1?sprint=fantome")

    await waitFor(() => {
        expect(lastPath).toBe("/projects/team-1")
    })
})

test("setSelectedProjectId navigue et réinitialise sprint et tâche", async () => {
    const { result } = renderSelection("/projects/team-1/list/task-9?sprint=s2")

    act(() => {
        result.current.setSelectedProjectId("team-2")
    })

    await waitFor(() => {
        expect(lastPath).toBe("/projects/team-2")
    })
})

test("setSelectedSprintId conserve le projet et ferme la tâche", async () => {
    const { result } = renderSelection("/projects/team-1/list/task-9?sprint=s1")

    act(() => {
        result.current.setSelectedSprintId("s2")
    })

    await waitFor(() => {
        expect(lastPath).toBe("/projects/team-1/list?sprint=s2")
    })
})
