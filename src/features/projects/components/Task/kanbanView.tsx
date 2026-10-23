import {
    DndContext,
    DragOverlay,
    type DropAnimation,
    defaultDropAnimationSideEffects,
} from "@dnd-kit/core"
import { useProjectListContext } from "@/features/projects/hooks/context/projectListContext"
import { useTaskContext } from "@/features/projects/hooks/context/taskContext"
import { KanbanColumn } from "./kanbanColumn"
import { DraggableTaskCard } from "./draggableTaskCard"
import { TaskCardContent } from "./taskCard"
import { TaskFilters } from "./taskFilters"
import type { TaskPriority } from "@/features/projects/types"

const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
        styles: { active: { opacity: "0.4" } },
    }),
}

export function KanbanView() {
    const {
        sprintInteractable,
        updateTaskPriority,
        updateTask,
        PRIORITY_ORDER,
        TASK_STATUS_COLUMNS,
        activeSprints,
        selectedSprint,
    } = useProjectListContext()

    const {
        tasksByStatus,
        startEditingTask,
        setTaskToDelete,
        setDetailTask,
        handleMoveTask,
        sensors,
        activeTask,
        handleDragStart,
        handleDragEnd,
        setCreateTaskOpen,
    } = useTaskContext()

    const handlePriorityChange = async (
        task: { id: string },
        newPriority: TaskPriority
    ) => {
        if (!sprintInteractable) return
        try {
            await updateTaskPriority(task.id, newPriority)
        } catch (err) {
            console.error("Error updating priority:", err)
        }
    }

    const handleTitleSave = async (taskId: string, title: string) => {
        try {
            await updateTask(taskId, { title })
        } catch (err) {
            console.error("Error updating title:", err)
        }
    }

    return (
        <div className="space-y-4">
            <TaskFilters />
            <DndContext
                sensors={sensors}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {TASK_STATUS_COLUMNS.map((column) => {
                        const tasksSorted = (
                            tasksByStatus[column.key]?.slice() ?? []
                        ).sort((a, b) => {
                            const pa = a.priority ?? "Normal"
                            const pb = b.priority ?? "Normal"
                            const ia = PRIORITY_ORDER.indexOf(pa)
                            const ib = PRIORITY_ORDER.indexOf(pb)
                            return ia - ib
                        })

                        return (
                            <KanbanColumn
                                key={column.key}
                                status={column.key}
                                label={column.label}
                                hint={column.hint}
                                count={tasksSorted.length}
                                onCreateTask={sprintInteractable ? () => setCreateTaskOpen(true) : undefined}
                            >
                                {tasksSorted.length === 0 ? (
                                    <div className="rounded-md border border-dashed bg-background/40 p-3 text-center text-xs text-muted-foreground">
                                        Aucune tâche
                                    </div>
                                ) : (
                                    tasksSorted.map((task) => (
                                        <DraggableTaskCard
                                            key={task.id}
                                            task={task}
                                            disabled={!sprintInteractable}
                                        >
                                            <TaskCardContent
                                                task={task}
                                                interactable={sprintInteractable}
                                                onDetail={setDetailTask}
                                                onEdit={startEditingTask}
                                                onDelete={setTaskToDelete}
                                                onMove={handleMoveTask}
                                                onPriorityChange={handlePriorityChange}
                                                onTitleSave={handleTitleSave}
                                                availableSprints={activeSprints}
                                                currentSprintId={selectedSprint?.id}
                                            />
                                        </DraggableTaskCard>
                                    ))
                                )}
                            </KanbanColumn>
                        )
                    })}
                </div>

                <DragOverlay dropAnimation={dropAnimation}>
                    {activeTask ? (
                        <TaskCardContent
                            task={activeTask}
                            interactable={false}
                            isOverlay
                            onEdit={() => {}}
                            onDelete={() => {}}
                            onPriorityChange={() => {}}
                        />
                    ) : null}
                </DragOverlay>
            </DndContext>
        </div>
    )
}
