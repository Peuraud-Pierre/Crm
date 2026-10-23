// Contrat d'URL de la feature projects (docs/ROUTING.md).
//
//   /projects                                    → accueil (liste des projets)
//   /projects/:projectId                         → projet, vue par défaut
//   /projects/:projectId/:view                   → vue kanban | list | calendar
//   /projects/:projectId/:view/:taskId           → sheet de détail d'une tâche
//   ?sprint=<sprintId>                           → sprint actif (filtre de la vue)
//
// L'URL est l'unique source de vérité : ni useState, ni localStorage ne
// dupliquent la sélection projet / sprint / tâche.
import { useCallback, useMemo } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router"

export const PROJECT_VIEWS = ["kanban", "list", "calendar"] as const
export type ProjectView = (typeof PROJECT_VIEWS)[number]

export const DEFAULT_PROJECT_VIEW: ProjectView = "kanban"

export const PROJECTS_ROOT_PATH = "/projects"

export function isProjectView(value: string | undefined): value is ProjectView {
    return (
        value !== undefined &&
        (PROJECT_VIEWS as readonly string[]).includes(value)
    )
}

export interface ProjectRouteState {
    projectId: string | null
    view: ProjectView
    taskId: string | null
    sprintId: string | null
}

/**
 * Construit le chemin canonique correspondant à un état de route.
 * Sans `projectId`, tout le reste est ignoré : on retombe sur l'accueil.
 */
export function buildProjectPath(state: Partial<ProjectRouteState>): string {
    const { projectId, taskId, sprintId } = state

    if (!projectId) return PROJECTS_ROOT_PATH

    const view = state.view ?? DEFAULT_PROJECT_VIEW
    // Le segment `view` n'est écrit que s'il porte une information : vue non
    // par défaut, ou tâche ouverte (le segment taskId ne peut pas le sauter).
    const needsView = view !== DEFAULT_PROJECT_VIEW || Boolean(taskId)

    let path = `${PROJECTS_ROOT_PATH}/${projectId}`
    if (needsView) path += `/${view}`
    if (taskId) path += `/${taskId}`
    if (sprintId) path += `?sprint=${encodeURIComponent(sprintId)}`

    return path
}

/**
 * Lit l'état de route de la feature et expose une navigation par delta :
 * `go({ taskId: null })` ne touche qu'au segment tâche.
 */
export function useProjectRouting() {
    const params = useParams()
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()

    const projectId = params.projectId ?? null
    const rawView = params.view
    const taskId = params.taskId ?? null
    const sprintId = searchParams.get("sprint")

    /** `false` quand l'URL porte un segment de vue inconnu (→ garde de redirection). */
    const viewIsValid = rawView === undefined || isProjectView(rawView)
    const view = isProjectView(rawView) ? rawView : DEFAULT_PROJECT_VIEW

    const current: ProjectRouteState = useMemo(
        () => ({ projectId, view, taskId, sprintId }),
        [projectId, view, taskId, sprintId]
    )

    const go = useCallback(
        (target: Partial<ProjectRouteState>, options?: { replace?: boolean }) => {
            navigate(buildProjectPath({ ...current, ...target }), options)
        },
        [current, navigate]
    )

    return { ...current, viewIsValid, go }
}

export type UseProjectRoutingReturn = ReturnType<typeof useProjectRouting>
