// context/project/ProjectProvider.tsx
// Root orchestrator — nests all domain providers in the right order.
//
// Provider hierarchy:
//   ProjectUIProvider        → display preferences (grid/list)
//     ProjectListProvider    → user, projects, selection, permissions, project actions
//       ProjectMembersProvider → members, directory, invites
//         SprintProvider     → sprint dialogs, sprint form, sprint actions
//           TaskProvider     → tasks, task forms, DnD, computed, filters
//
// useProjectCtx() is a backward-compat merge for components not yet migrated
// to a specific sub-context.

import React from "react"
import { ProjectUIProvider } from "@/features/projects/hooks/context/projectUIContext"
import { ProjectListProvider, useProjectListContext } from "@/features/projects/hooks/context/projectListContext"
import { ProjectMembersProvider, useProjectMembersContext } from "@/features/projects/hooks/context/projectMembersContext"
import { SprintProvider, useSprintContext } from "@/features/projects/hooks/context/sprintContext"
import { TaskProvider, useTaskContext } from "@/features/projects/hooks/context/taskContext"

export function ProjectProvider({ children }: { children: React.ReactNode }) {
    return (
        <ProjectUIProvider>
            <ProjectListProvider>
                <ProjectMembersProvider>
                    <SprintProvider>
                        <TaskProvider>
                            {children}
                        </TaskProvider>
                    </SprintProvider>
                </ProjectMembersProvider>
            </ProjectListProvider>
        </ProjectUIProvider>
    )
}

// ─── Backward-compat merge hook ───────────────────────────────────────────────
// Merges all sub-contexts into one flat object.
// Components should progressively migrate to individual context hooks.
export function useProjectCtx() {
    const list = useProjectListContext()
    const members = useProjectMembersContext()
    const sprint = useSprintContext()
    const task = useTaskContext()

    return {
        ...list,
        ...members,
        ...sprint,
        ...task,
        // task.submitting and sprint.submitting both exist — keep task's as the
        // primary since most callers check task-related submitting states
        submitting: task.submitting ?? sprint.submitting,
    }
}

// ─── Re-exports ───────────────────────────────────────────────────────────────
export { useProjectUIContext } from "@/features/projects/hooks/context/projectUIContext"
export { useProjectListContext } from "@/features/projects/hooks/context/projectListContext"
export { useProjectMembersContext } from "@/features/projects/hooks/context/projectMembersContext"
export { useSprintContext } from "@/features/projects/hooks/context/sprintContext"
export { useTaskContext } from "@/features/projects/hooks/context/taskContext"

export type ProjectContextType = ReturnType<typeof useProjectCtx>
