import { supabase } from "@/integrations/supabase/client"

/**
 * Annuaire des profils partagé en lecture seule (tickets, sell-journal,
 * pingpong, galerie...). Les mutations et la gestion fine des utilisateurs
 * vivent dans features/administration.
 */
export interface Profile {
    id: string
    user_id: string
    email: string
    full_name: string
    status: "active" | "inactive" | "pending"
    avatar_url?: string | null
    last_login?: string | null
    role_id?: string | null
    service_id?: string | null
    created_at: string
    updated_at: string
    role?: { id: string; nom: string } | null
    service?: { id: string; nom: string } | null
}

// Supabase peut renvoyer une jointure sous forme d'objet ou de tableau selon
// la cardinalité inférée — normalisation en objet unique ou null.
type RawRelation =
    | { id: string; nom: string }
    | { id: string; nom: string }[]
    | null

function normalizeRelation(
    value: RawRelation
): { id: string; nom: string } | null {
    if (Array.isArray(value)) return value[0] ?? null
    return value ?? null
}

export async function listProfilesDirectory(): Promise<Profile[]> {
    const { data, error } = await supabase
        .from("profiles")
        .select(
            `
            id,
            user_id,
            email,
            full_name,
            avatar_url,
            status,
            updated_at,
            last_login,
            created_at,
            service_id,
            role_id,
            role:roles(id, nom),
            service:services(id, nom)
        `
        )
        // Les profils archivés (utilisateur supprimé) restent en base pour la
        // traçabilité des journaux d'activité — jamais dans l'annuaire.
        .is("archived_at", null)
        .order("created_at", { ascending: false })

    if (error) throw error

    return (data ?? []).map((row) => {
        const { role, service, ...rest } = row as Omit<
            Profile,
            "role" | "service"
        > & { role: RawRelation; service: RawRelation }
        return {
            ...rest,
            role: normalizeRelation(role),
            service: normalizeRelation(service),
        }
    })
}

/** Abonnement realtime à la table profiles. Renvoie la fonction de désinscription. */
export function subscribeToProfilesDirectory(onChange: () => void): () => void {
    const channel = supabase
        .channel("profiles-realtime")
        .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "profiles" },
            onChange
        )
        .subscribe()

    return () => {
        supabase.removeChannel(channel)
    }
}
