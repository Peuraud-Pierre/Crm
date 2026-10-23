import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/atoms/card"
import { useProjectListContext } from "@/features/projects/hooks/context/projectListContext"

import { useProjectMembersContext } from "@/features/projects/hooks/context/projectMembersContext"
import { useSprintContext } from "@/features/projects/hooks/context/sprintContext"
import { useTaskContext } from "@/features/projects/hooks/context/taskContext"
import { ConfirmDialog } from "../utils/confirmDialog"
import { TaskDialog } from "../Task/taskDialog"
import { TaskDetailSheet } from "../Task/taskDetailSheet"
import { CreateSprint } from "./Dialog/CreateSprint"
import { InviteMember } from "./Dialog/InviteMember"
import { SelectedProject } from "./SelectedProject"
import { ProjectsHome } from "./projectsHome"

export function Main() {
    const {
        restrictedAccess,
        loading,
        selectedProject,
    } = useProjectListContext()

    const { projectMembers } = useProjectMembersContext()

    const {
        archiveSprintOpen,
        setArchiveSprintOpen,
        deleteSprintOpen,
        setDeleteSprintOpen,
        handleArchiveSprint,
        handleDeleteSprint,
        submitting: sprintSubmitting,
    } = useSprintContext()

    const {
        taskToDelete,
        setTaskToDelete,
        handleDeleteTask,
        submitting: taskSubmitting,
        createTaskOpen,
        setCreateTaskOpen,
        taskForm,
        setTaskForm,
        handleCreateTask,
        editTask,
        setEditTask,
        editTaskForm,
        setEditTaskForm,
        handleEditTaskSubmit,
    } = useTaskContext()

    const { selectedSprint } = useProjectListContext()

    if (restrictedAccess) {
        return (
            <div className="flex flex-1 flex-col">
                <main className="flex-1 p-6">
                    <Card className="shadow-surface">
                        <CardHeader>
                            <CardTitle>Accès réservé</CardTitle>
                        </CardHeader>
                        <CardContent>
                            Cette page est réservée à l'équipe Tech (gestion) et à
                            la Direction (consultation).
                        </CardContent>
                    </Card>
                </main>
            </div>
        )
    }

    return (
        <div className="flex flex-1 min-w-0">
            {/* Main content: ProjectsHome or SelectedProject */}
            <div className="flex flex-1 min-w-0 flex-col">
                {selectedProject ? (
                    <SelectedProject />
                ) : (
                    !loading && <ProjectsHome />
                )}
            </div>

            {/* Dialogs & sheets */}
            <TaskDetailSheet />
            <InviteMember />
            <CreateSprint />

            <TaskDialog
                mode="create"
                open={createTaskOpen}
                onOpenChange={setCreateTaskOpen}
                form={taskForm}
                onFormChange={setTaskForm}
                onSubmit={(files) => handleCreateTask(setCreateTaskOpen, files)}
                submitting={taskSubmitting === "task"}
                members={projectMembers}
            />

            <TaskDialog
                mode="edit"
                open={Boolean(editTask)}
                onOpenChange={(open) => !open && setEditTask(null)}
                form={editTaskForm}
                onFormChange={setEditTaskForm}
                onSubmit={handleEditTaskSubmit}
                submitting={taskSubmitting === "edit-task"}
                members={projectMembers}
                taskId={editTask?.id}
            />

            <ConfirmDialog
                open={Boolean(taskToDelete)}
                onOpenChange={(open) => !open && setTaskToDelete(null)}
                title="Supprimer la tâche ?"
                description="Cette action est irréversible. La tâche sera retirée du sprint."
                onConfirm={() =>
                    void handleDeleteTask({ taskToDelete, setTaskToDelete })
                }
                disabled={
                    taskToDelete
                        ? taskSubmitting === `delete-task:${taskToDelete.id}`
                        : false
                }
            />

            <ConfirmDialog
                open={archiveSprintOpen}
                onOpenChange={setArchiveSprintOpen}
                title="Archiver ce sprint ?"
                description="Le sprint sera marqué comme archivé. Les membres seront informés et les tâches ne devraient plus être modifiées."
                onConfirm={handleArchiveSprint}
                disabled={
                    selectedSprint
                        ? sprintSubmitting === `archive-sprint:${selectedSprint.id}`
                        : false
                }
            />

            <ConfirmDialog
                open={deleteSprintOpen}
                onOpenChange={setDeleteSprintOpen}
                title="Supprimer ce sprint ?"
                description="Cette action supprime également toutes les tâches associées. Les membres seront notifiés."
                onConfirm={handleDeleteSprint}
                disabled={sprintSubmitting === "delete-sprint"}
            />
        </div>
    )
}

