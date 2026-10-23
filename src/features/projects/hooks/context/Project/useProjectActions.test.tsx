import { act, renderHook } from "@testing-library/react"
import { expect, rstest, test } from "@rstest/core"
import { useState } from "react"

const mocks = rstest.hoisted(() => ({
    toastError: rstest.fn(),
    toastSuccess: rstest.fn(),
    createTeam: rstest.fn(),
    removeTeamMember: rstest.fn(),
    addTeamMember: rstest.fn(),
    updateProjectStatus: rstest.fn(),
    deleteTeam: rstest.fn(),
    setSelectedProjectId: rstest.fn(),
    setCreateProjectOpen: rstest.fn(),
}))

rstest.mock("sonner", () => ({
    toast: { error: mocks.toastError, success: mocks.toastSuccess },
}))

import { useProjectActions } from "./useProjectActions"
import type { UseProjectSelectionReturn } from "./useProjectSelection"
import type { UseProjectPermissionsReturn } from "./useProjectPermissions"
import type { UseProjectFormsReturn } from "./useProjectForms"
import type { UseProjectsReturn } from "@/features/projects/hooks/Projects/useProjects"
import type { AppUser } from "@/features/auth/hooks/useAuth"

const baseSelection = {
    selectedProject: {
        id: "p1",
        name: "Project",
        owner_id: "user-1",
        members: [{ user_id: "user-2" }],
    },
    setSelectedProjectId: mocks.setSelectedProjectId,
}

const user = { user_id: "user-1", full_name: "Admin", email: "a@b.com" }

test("handleCreateProject validates name and resets form", async () => {
    mocks.createTeam.mockResolvedValue({ success: true })

    const { result: emptyResult } = renderHook(() => {
        const [projectForm, setProjectForm] = useState({
            name: "",
            description: "",
            members: [],
        })
        return useProjectActions(
            baseSelection as unknown as UseProjectSelectionReturn,
            { projectForm, setProjectForm, setCreateProjectOpen: mocks.setCreateProjectOpen } as unknown as UseProjectFormsReturn,
            {
                createTeam: mocks.createTeam,
                removeTeamMember: mocks.removeTeamMember,
                addTeamMember: mocks.addTeamMember,
                updateProjectStatus: mocks.updateProjectStatus,
                deleteTeam: mocks.deleteTeam,
            } as unknown as UseProjectsReturn,
            { isSuperAdmin: true } as unknown as UseProjectPermissionsReturn,
            user as unknown as AppUser
        )
    })

    await act(async () => {
        await emptyResult.current.handleCreateProject()
    })
    expect(mocks.toastError).toHaveBeenCalledWith(
        "Nom requis",
        expect.objectContaining({ description: "Veuillez nommer le projet" })
    )

    const { result: filledResult } = renderHook(() => {
        const [projectForm, setProjectForm] = useState({
            name: "Project",
            description: "",
            members: ["user-2"],
        })
        return useProjectActions(
            baseSelection as unknown as UseProjectSelectionReturn,
            { projectForm, setProjectForm, setCreateProjectOpen: mocks.setCreateProjectOpen } as unknown as UseProjectFormsReturn,
            {
                createTeam: mocks.createTeam,
                removeTeamMember: mocks.removeTeamMember,
                addTeamMember: mocks.addTeamMember,
                updateProjectStatus: mocks.updateProjectStatus,
                deleteTeam: mocks.deleteTeam,
            } as unknown as UseProjectsReturn,
            { isSuperAdmin: true } as unknown as UseProjectPermissionsReturn,
            user as unknown as AppUser
        )
    })

    await act(async () => {
        await filledResult.current.handleCreateProject()
    })

    expect(mocks.createTeam).toHaveBeenCalledWith(
        expect.objectContaining({
            name: "Project",
            memberIds: ["user-2"],
        })
    )
})

test("handleRemoveMember blocks removing owner", async () => {
    const { result } = renderHook(() => {
        const [projectForm, setProjectForm] = useState({
            name: "Project",
            description: "",
            members: [],
        })
        return useProjectActions(
            baseSelection as unknown as UseProjectSelectionReturn,
            { projectForm, setProjectForm, setCreateProjectOpen: mocks.setCreateProjectOpen } as unknown as UseProjectFormsReturn,
            {
                createTeam: mocks.createTeam,
                removeTeamMember: mocks.removeTeamMember,
                addTeamMember: mocks.addTeamMember,
                updateProjectStatus: mocks.updateProjectStatus,
                deleteTeam: mocks.deleteTeam,
            } as unknown as UseProjectsReturn,
            { isSuperAdmin: false } as unknown as UseProjectPermissionsReturn,
            user as unknown as AppUser
        )
    })

    await act(async () => {
        await result.current.handleRemoveMember("user-1")
    })

    expect(mocks.toastError).toHaveBeenCalledWith(
        "Action interdite",
        expect.objectContaining({
            description: "Le responsable du projet ne peut pas être retiré",
        })
    )
})

test("handleArchiveProject clears selection on success", async () => {
    mocks.updateProjectStatus.mockResolvedValue({ success: true })

    const { result } = renderHook(() => {
        const [projectForm, setProjectForm] = useState({
            name: "Project",
            description: "",
            members: [],
        })
        return useProjectActions(
            baseSelection as unknown as UseProjectSelectionReturn,
            { projectForm, setProjectForm, setCreateProjectOpen: mocks.setCreateProjectOpen } as unknown as UseProjectFormsReturn,
            {
                createTeam: mocks.createTeam,
                removeTeamMember: mocks.removeTeamMember,
                addTeamMember: mocks.addTeamMember,
                updateProjectStatus: mocks.updateProjectStatus,
                deleteTeam: mocks.deleteTeam,
            } as unknown as UseProjectsReturn,
            { isSuperAdmin: true } as unknown as UseProjectPermissionsReturn,
            user as unknown as AppUser
        )
    })

    await act(async () => {
        await result.current.handleArchiveProject()
    })

    expect(mocks.setSelectedProjectId).toHaveBeenCalledWith(null)
})
