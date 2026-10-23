// Mocked hooks below intentionally use the `useX` name to match the real modules.
/* eslint-disable react-x/no-unnecessary-use-prefix */
import { renderHook } from "@testing-library/react"
import { expect, rstest, test } from "@rstest/core"
import type { ReactNode } from "react"

const { mocks, passthrough } = rstest.hoisted(() => ({
    mocks: {
        list: { listValue: "list", projectsInvolved: [] },
        members: { membersValue: "members", directoryMembers: [] },
        sprint: { sprintValue: "sprint", submitting: "sprint-submitting" as string | undefined },
        task: { taskValue: "task", submitting: "task-submitting" as string | undefined },
    },
    passthrough: ({ children }: { children: ReactNode }) => children,
}))

rstest.mock("@/features/projects/hooks/context/projectUIContext", () => ({
    ProjectUIProvider: passthrough,
    useProjectUIContext: () => ({}),
}))

rstest.mock("@/features/projects/hooks/context/projectListContext", () => ({
    ProjectListProvider: passthrough,
    useProjectListContext: () => mocks.list,
}))

rstest.mock("@/features/projects/hooks/context/projectMembersContext", () => ({
    ProjectMembersProvider: passthrough,
    useProjectMembersContext: () => mocks.members,
}))

rstest.mock("@/features/projects/hooks/context/sprintContext", () => ({
    SprintProvider: passthrough,
    useSprintContext: () => mocks.sprint,
}))

rstest.mock("@/features/projects/hooks/context/taskContext", () => ({
    TaskProvider: passthrough,
    useTaskContext: () => mocks.task,
}))

import { ProjectProvider, useProjectCtx } from "./ProjectProvider"

test("useProjectCtx merges values from all nested contexts", () => {
    const { result } = renderHook(() => useProjectCtx(), {
        wrapper: ProjectProvider,
    })

    const ctx = result.current as Record<string, unknown>

    expect(ctx.listValue).toBe("list")
    expect(ctx.membersValue).toBe("members")
    expect(ctx.sprintValue).toBe("sprint")
    expect(ctx.taskValue).toBe("task")
})

test("useProjectCtx prefers task.submitting over sprint.submitting", () => {
    mocks.sprint.submitting = "sprint-busy"
    mocks.task.submitting = "task-busy"

    const { result } = renderHook(() => useProjectCtx(), {
        wrapper: ProjectProvider,
    })

    expect(result.current.submitting).toBe("task-busy")
})

test("useProjectCtx falls back to sprint.submitting when task.submitting is undefined", () => {
    mocks.sprint.submitting = "sprint-busy"
    mocks.task.submitting = undefined

    const { result } = renderHook(() => useProjectCtx(), {
        wrapper: ProjectProvider,
    })

    expect(result.current.submitting).toBe("sprint-busy")
})
