import { act, renderHook } from "@testing-library/react"
import { expect, rstest, test } from "@rstest/core"
import type { DragStartEvent, DragEndEvent } from "@dnd-kit/core"

import { useDragAndDrop } from "./useDragAndDrop"

test("useDragAndDrop sets activeTask on drag start and calls updateTaskStatus on drop", async () => {
    const updateTaskStatus = rstest.fn()
    const task = { id: "task-1", status: "todo" }
    const selection = {
        selectedSprint: { tasks: [task] },
    }
    const permissions = { sprintInteractable: true }

    const { result } = renderHook(() =>
        useDragAndDrop({
            selection: selection as unknown as Parameters<typeof useDragAndDrop>[0]["selection"],
            projectApi: { updateTaskStatus } as unknown as Parameters<typeof useDragAndDrop>[0]["projectApi"],
            permissions: permissions as unknown as Parameters<typeof useDragAndDrop>[0]["permissions"],
        })
    )

    // Drag start
    act(() => {
        result.current.handleDragStart({
            active: { id: "task-1", data: { current: { task } } },
        } as unknown as DragStartEvent)
    })
    expect(result.current.activeTask).toEqual(task)

    // Drag end (drop on "done" column)
    await act(async () => {
        await result.current.handleDragEnd({
            active: { id: "task-1" },
            over: { id: "done" },
        } as unknown as DragEndEvent)
    })
    expect(updateTaskStatus).toHaveBeenCalledWith("task-1", "done")
    expect(result.current.activeTask).toBeNull()
})

test("useDragAndDrop does not set activeTask when not interactable", () => {
    const { result } = renderHook(() =>
        useDragAndDrop({
            selection: { selectedSprint: { tasks: [] } } as unknown as Parameters<typeof useDragAndDrop>[0]["selection"],
            projectApi: { updateTaskStatus: rstest.fn() } as unknown as Parameters<typeof useDragAndDrop>[0]["projectApi"],
            permissions: { sprintInteractable: false } as unknown as Parameters<typeof useDragAndDrop>[0]["permissions"],
        })
    )

    act(() => {
        result.current.handleDragStart({
            active: { id: "task-1", data: { current: {} } },
        } as unknown as DragStartEvent)
    })

    expect(result.current.activeTask).toBeNull()
})
