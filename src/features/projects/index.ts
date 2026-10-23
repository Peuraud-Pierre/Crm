// Context
export { ProjectProvider } from "./hooks/context/Project/ProjectProvider"
export { useProjectCtx } from "./hooks/context/Project/ProjectProvider"

// Types
export type {
    SprintStatus,
    TaskStatus,
    TaskPriority,
    ProjectStatus,
    MemberProfile,
    ProjectTeamMember,
    ProjectTask,
    ProjectSprint,
    ProjectTeam,
    ProjectSelection,
    NotificationPayload,
} from "./types"

// Constants
export {
    PRIORITY_META,
    PRIORITY_ORDER,
    TASK_STATUS_COLUMNS,
    MEMBER_COLOR_PALETTE,
} from "./project_constants"

// Utils
export { hashToColor } from "./utils/hashToColor"
export { formatDate, formatDateRange } from "./utils/formatDate"

/** Modules posables sur le dashboard (contrat shared/types/widget.types). */
export { projectWidgets } from "./widgets"
