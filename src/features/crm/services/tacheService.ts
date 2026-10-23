import { supabase } from "@/integrations/supabase/client"
import type { Tache, TacheInsert } from "@/features/crm/types"

/**
 * Colonnes + jointure client + rôle du owner (via la contrainte
 * Tache_crm_owner_fkey → profiles → roles) + rôle du créateur (via
 * Tache_crm_creator_id_fkey). Sert à colorer une tâche selon le rôle de son
 * créateur (violet si admin/superadmin — voir TaskItem.tsx), indépendamment
 * de qui la consulte ou de qui elle est assignée.
 */
const TASK_SELECT_WITH_OWNER_ROLE =
    "*, client(id, nom), owner_role:profiles!Tache_crm_owner_fkey(role:roles(nom)), creator_role:profiles!Tache_crm_creator_id_fkey(role:roles(nom))"

export async function fetchOneTaskWithRelations(
    taskId: string
): Promise<Tache | null> {
    const { data, error } = await supabase
        .from("Tache_crm")
        .select(TASK_SELECT_WITH_OWNER_ROLE)
        .eq("id", taskId)
        .single()

    if (error) {
        console.error("❌ Erreur fetch one task:", error)
        return null
    }
    return data as unknown as Tache
}

export async function createTache(
    payload: TacheInsert & { owner: string; creator_id: string }
): Promise<Tache> {
    const { data, error } = await supabase
        .from("Tache_crm")
        .insert([payload])
        .select(TASK_SELECT_WITH_OWNER_ROLE)
        .single()

    if (error) throw error
    return data as unknown as Tache
}

// Plafond de sécurité : évite de rapatrier un historique complet illimité
// (des milliers de tâches validées accumulées) sur les postes les moins
// puissants — 1000 lignes couvre très largement un usage normal.
const TASKS_BY_OWNER_LIMIT = 1000

export async function fetchTachesByOwner(ownerId: string): Promise<Tache[]> {
    const { data, error } = await supabase
        .from("Tache_crm")
        .select(TASK_SELECT_WITH_OWNER_ROLE)
        .eq("owner", ownerId)
        .order("date", { ascending: false })
        .limit(TASKS_BY_OWNER_LIMIT)

    if (error) throw error
    return (data as unknown as Tache[]) ?? []
}

/**
 * Tâches que j'ai créées mais assignées à quelqu'un d'autre (creator_id =
 * moi, owner ≠ moi) — onglet « Assignées » de la page Tâches.
 */
export async function fetchTachesDelegatedBy(
    creatorId: string
): Promise<Tache[]> {
    const { data, error } = await supabase
        .from("Tache_crm")
        .select(TASK_SELECT_WITH_OWNER_ROLE)
        .eq("creator_id", creatorId)
        .neq("owner", creatorId)
        .order("date", { ascending: false })
        .limit(TASKS_BY_OWNER_LIMIT)

    if (error) throw error
    return (data as unknown as Tache[]) ?? []
}

/**
 * Plafond du widget de dashboard : il n'affiche qu'une poignée de lignes,
 * et rapatrier mille tâches pour en montrer cinq serait absurde.
 */
export async function fetchUpcomingTachesByOwner(
    ownerId: string,
    limit: number
): Promise<Tache[]> {
    const { data, error } = await supabase
        .from("Tache_crm")
        .select(TASK_SELECT_WITH_OWNER_ROLE)
        .eq("owner", ownerId)
        .or("valide.is.null,valide.eq.false")
        .order("date", { ascending: true })
        .limit(limit)

    if (error) throw error
    return (data as unknown as Tache[]) ?? []
}

/**
 * Liste LÉGÈRE de toutes les tâches (board, colonnes minimales : id, client,
 * date) — voir le commentaire d'origine dans use_tache.tsx pour le pourquoi
 * (gain mémoire par sélection de colonnes plutôt que par filtrage d'ids).
 */
export async function fetchAllTachesLight(): Promise<Tache[]> {
    const { data, error } = await supabase
        .from("Tache_crm")
        .select("id, client, date")
        .order("date", { ascending: false })

    if (error) throw error
    return (data as unknown as Tache[]) ?? []
}

export async function fetchTachesByClient(clientId: string): Promise<Tache[]> {
    const { data, error } = await supabase
        .from("Tache_crm")
        .select("*, client(id, nom)")
        .eq("client", clientId)
        .order("date", { ascending: false })

    if (error) throw error
    return (data as unknown as Tache[]) ?? []
}

export async function updateTache(
    id: string,
    payload: Partial<Omit<Tache, "owner_role" | "creator_role">> & {
        client?: string | null
    }
): Promise<void> {
    const { error } = await supabase.from("Tache_crm").update(payload).eq("id", id)
    if (error) throw error
}

export async function deleteTache(id: string): Promise<void> {
    const { error } = await supabase.from("Tache_crm").delete().eq("id", id)
    if (error) throw error
}
