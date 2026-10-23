import { renderHook } from "@testing-library/react"
import { expect, test } from "@rstest/core"

import { useProjectPermissions } from "./useProjectPermissions"
import type { UseProjectSelectionReturn } from "./useProjectSelection"
import type { AppUser } from "@/features/auth/hooks/useAuth"

const makeSelection = (overrides: Record<string, unknown>) => ({
    selectedProject: {
        id: "p1",
        owner_id: "user-1",
        status: "active",
        members: [{ user_id: "user-2" }],
    },
    selectedSprint: { id: "s1", status: "active" },
    projectsInvolved: [],
    ...overrides,
})

test("useProjectPermissions computes flags for owner", () => {
    const selection = makeSelection({})
    const user = { user_id: "user-1", role: "Super admin", service: "Tech" }

    const { result } = renderHook(() =>
        useProjectPermissions(selection as unknown as UseProjectSelectionReturn, user as unknown as AppUser)
    )

    expect(result.current.isSuperAdmin).toBe(true)
    expect(result.current.canCreateProjects).toBe(true)
    expect(result.current.isProjectOwner).toBe(true)
    expect(result.current.canManageProject).toBe(true)
    expect(result.current.sprintInteractable).toBe(true)
})

test("useProjectPermissions blocks when archived", () => {
    const selection = makeSelection({
        selectedProject: {
            id: "p1",
            owner_id: "user-2",
            status: "archived",
            members: [{ user_id: "user-1" }],
        },
        selectedSprint: { id: "s1", status: "archived" },
    })
    const user = { user_id: "user-1", role: "User", service: "CRM" }

    const { result } = renderHook(() =>
        useProjectPermissions(selection as unknown as UseProjectSelectionReturn, user as unknown as AppUser)
    )

    expect(result.current.isProjectArchived).toBe(true)
    expect(result.current.isSprintArchived).toBe(true)
    expect(result.current.canInteractWithProject).toBe(false)
    expect(result.current.sprintInteractable).toBe(false)
})
