// context/project/useProjectSelection.ts
//
// Sélection projet / sprint entièrement dérivée de l'URL (docs/ROUTING.md).
// Aucun useState, aucun localStorage : `/projects/:projectId?/:view?/:taskId?`
// (+ `?sprint=`) est l'unique source de vérité. Les setters exposés
// (`setSelectedProjectId`, `setSelectedSprintId`) sont conservés pour les
// appelants existants mais naviguent au lieu de muter un état local.
import { useCallback, useEffect, useMemo } from "react"
import type {
    ProjectSprint,
    ProjectTeam,
    ProjectTeamMember,
} from "@/features/projects/types"
import type { AppUser } from "@/features/auth/hooks/useAuth"
import type { UseProjectsReturn } from "@/features/projects/hooks/Projects/useProjects"
import { useProjectRouting } from "@/features/projects/routes/projectRoutes"

export function useProjectSelection(
    projectApi: UseProjectsReturn,
    user: AppUser
) {
    const { teams, loading } = projectApi
    const currentUserId = user?.user_id

    const routing = useProjectRouting()
    const { projectId, taskId, sprintId, view, viewIsValid, go } = routing

    // Teams actifs / archivés
    const activeTeams = useMemo(
        () => teams.filter((t) => t.status !== "archived"),
        [teams]
    )
    const archivedTeams = useMemo(
        () => teams.filter((t) => t.status === "archived"),
        [teams]
    )

    const projectsInvolved = useMemo(() => {
        if (!currentUserId) return []
        return activeTeams.filter(
            (t: ProjectTeam) =>
                t.owner_id === currentUserId ||
                t.members.some(
                    (m: ProjectTeamMember) => m.user_id === currentUserId
                )
        )
    }, [activeTeams, currentUserId])

    const selectedProject = useMemo(
        () => teams.find((t: ProjectTeam) => t.id === projectId) ?? null,
        [teams, projectId]
    )

    /**
     * Changer de projet réinitialise vue, sprint et tâche : les ids d'un projet
     * n'ont aucun sens dans un autre. Push (le retour navigateur défait).
     */
    const setSelectedProjectId = useCallback(
        (id: string | null) => {
            go({ projectId: id, view: undefined, taskId: null, sprintId: null })
        },
        [go]
    )

    // Sprints du projet courant
    const sortedSprints = useMemo(() => {
        if (!selectedProject) return []
        return [...selectedProject.sprints].sort((a, b) =>
            (a.start_date ?? "").localeCompare(b.start_date ?? "")
        )
    }, [selectedProject])

    const activeSprints = useMemo(
        () => sortedSprints.filter((s) => s.status !== "archived"),
        [sortedSprints]
    )
    const archivedSprintsList = useMemo(
        () => sortedSprints.filter((s) => s.status === "archived"),
        [sortedSprints]
    )

    // Sprint courant : celui de l'URL s'il existe, sinon repli sur le premier
    // sprint disponible — calculé au rendu, jamais stocké.
    const sprintParamIsValid =
        sprintId !== null &&
        sortedSprints.some((s: ProjectSprint) => s.id === sprintId)

    const selectedSprintId = sprintParamIsValid
        ? sprintId
        : activeSprints[0]?.id ?? archivedSprintsList[0]?.id ?? null

    const selectedSprint =
        sortedSprints.find((s: ProjectSprint) => s.id === selectedSprintId) ??
        null

    const setSelectedSprintId = useCallback(
        (id: string | null) => {
            // Changer de sprint ferme la tâche ouverte (elle appartient à l'ancien).
            go({ sprintId: id, taskId: null })
        },
        [go]
    )

    // ─── Gardes de route ──────────────────────────────────────────────────────
    // Uni-directionnelles : l'URL invalide est corrigée en `replace`, jamais
    // l'inverse (pas de synchronisation état → URL).
    useEffect(() => {
        // Vue inconnue dans l'URL (ex. /projects/<id>/foo) → forme canonique.
        if (projectId && !viewIsValid) {
            go({ view }, { replace: true })
            return
        }

        // Projet inconnu une fois les données chargées → retour à l'accueil.
        if (projectId && !loading && !selectedProject) {
            go({ projectId: null }, { replace: true })
            return
        }

        // Sprint inconnu (supprimé, ou d'un autre projet) → on nettoie le param.
        if (selectedProject && sprintId && !sprintParamIsValid) {
            go({ sprintId: null, taskId: null }, { replace: true })
        }
    }, [
        projectId,
        viewIsValid,
        view,
        loading,
        selectedProject,
        sprintId,
        sprintParamIsValid,
        go,
    ])

    return {
        teams,
        selectedProjectId: projectId,
        setSelectedProjectId,
        selectedProject,
        projectsInvolved,

        selectedSprintId,
        setSelectedSprintId,
        selectedSprint,

        // Route (consommée par taskContext pour le sheet de détail et par
        // SelectedProject pour le sélecteur de vue)
        view,
        taskId,
        go,

        sortedSprints,
        activeSprints,
        activeTeams,
        archivedSprintsList,
        archivedProjects: archivedTeams,
    }
}

export type UseProjectSelectionReturn = ReturnType<typeof useProjectSelection>
