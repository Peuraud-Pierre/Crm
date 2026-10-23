import type { MemberProfile, ProjectTask, TaskPriority } from "@/features/projects/types"

export type UseProjectFormsReturn = {
    createProjectOpen: boolean
    setCreateProjectOpen: (open: boolean) => void
    selectedCreationMembers: MemberProfile[]
    projectForm: { name: string; description: string; members: string[] }
    setProjectForm: React.Dispatch<React.SetStateAction<{ name: string; description: string; members: string[] }>>
    sprintForm: { name: string; goal: string; startDate: string; endDate: string }
    setSprintForm: React.Dispatch<React.SetStateAction<{ name: string; goal: string; startDate: string; endDate: string }>>
    taskForm: { title: string; description: string; priority: TaskPriority; dueDate: string; assigneeId: string }
    setTaskForm: React.Dispatch<React.SetStateAction<{ title: string; description: string; priority: TaskPriority; dueDate: string; assigneeId: string }>>
    editTask: ProjectTask | null
    setEditTask: (task: ProjectTask | null) => void
    editTaskForm: { title: string; description: string; priority: TaskPriority; dueDate: string; assigneeId: string }
    setEditTaskForm: React.Dispatch<React.SetStateAction<{ title: string; description: string; priority: TaskPriority; dueDate: string; assigneeId: string }>>
}
