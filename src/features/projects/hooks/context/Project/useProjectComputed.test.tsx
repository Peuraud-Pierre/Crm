import { renderHook } from "@testing-library/react"
import { expect, test } from "@rstest/core"

import { useProjectComputed } from "./useProjectComputed"
import type { UseProjectSelectionReturn } from "./useProjectSelection"
import type { ProjectTask } from "@/features/projects/types"

test("useProjectComputed groups tasks by status and position", () => {
    const selection = {
        selectedSprint: {
            id: "s1",
            tasks: [
                { id: "t1", status: "todo", position: 2 },
                { id: "t2", status: "todo", position: 1 },
                { id: "t3", status: "done", position: 0 },
            ],
        },
    } as unknown as UseProjectSelectionReturn

    const { result } = renderHook(() => useProjectComputed(selection))

    expect(result.current.tasksByStatus.todo.map((t: ProjectTask) => t.id)).toEqual([
        "t2",
        "t1",
    ])
    expect(result.current.tasksByStatus.done.map((t: ProjectTask) => t.id)).toEqual([
        "t3",
    ])
})

test("useProjectComputed returns empty buckets without sprint", () => {
    const selection = { selectedSprint: null } as unknown as UseProjectSelectionReturn
    const { result } = renderHook(() => useProjectComputed(selection))

    expect(result.current.tasksByStatus.todo).toHaveLength(0)
    expect(result.current.tasksByStatus.in_progress).toHaveLength(0)
    expect(result.current.tasksByStatus.review).toHaveLength(0)
    expect(result.current.tasksByStatus.done).toHaveLength(0)
})
