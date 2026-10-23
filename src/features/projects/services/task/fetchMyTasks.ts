import { supabase } from "@/integrations/supabase/client"
import type { ProjectTask } from "../../types"

/**
 * Une tâche, avec le sprint et le projet auxquels elle appartient.
 *
 * Il n'y a **pas** de `project_id` sur `project_tasks` : le projet se
 * rejoint par le sprint (`project_tasks.sprint_id` → `project_sprints.
 * team_id` → `project_teams`). Une tâche peut n'avoir aucun sprint, donc
 * aucun projet résoluble — d'où les deux niveaux optionnels.
 */
export interface MyTaskRow extends ProjectTask {
    sprint?: {
        id: string
        name: string | null
        team?: { id: string; name: string | null } | null
    } | null
}

/**
 * Les tâches ouvertes assignées à quelqu'un, échéance la plus proche
 * d'abord.
 *
 * `done` est exclu en base et non côté client : une équipe active accumule
 * des centaines de tâches terminées, et les rapatrier pour les jeter
 * ensuite ferait payer à l'accueil le coût de tout l'historique.
 *
 * Le sprint et le projet sont incorporés par PostgREST : les deux clés
 * étrangères existent, contrairement au cas `arrivage_manuel` où
 * l'absence de contrainte oblige à résoudre côté client. Ils portent la
 * profondeur qui manquait — « quelle tâche » ne dit rien sans « de quel
 * projet » — et rendent le deep-link possible, la route de détail
 * réclamant l'identifiant du projet en plus de celui de la tâche.
 */
export async function fetchMyOpenTasks(
    userId: string,
    limit: number
): Promise<MyTaskRow[]> {
    const { data, error } = await supabase
        .from("project_tasks")
        .select("*, sprint:project_sprints(id, name, team:project_teams(id, name))")
        .eq("assignee_id", userId)
        .neq("status", "done")
        // Une tâche sans échéance n'est pas urgente : elle passe après
        // celles qui en ont une.
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(limit)

    if (error) throw error
    return (data ?? []) as unknown as MyTaskRow[]
}
