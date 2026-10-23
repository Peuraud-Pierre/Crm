import { supabase } from "@/integrations/supabase/client"

/**
 * Service d'accès aux référentiels utilisateurs (rôles, services).
 * Requêtes déplacées telles quelles depuis UsersContext (couche service
 * obligatoire — voir Architecture_Feature.pdf §5).
 */

/** Liste des rôles, triés par date de création. */
export async function fetchRoles() {
    try {
        const { data, error } = await supabase
            .from("roles")
            .select("*")
            .order("created_at", { ascending: true })
        if (error) throw error
        return data
    } catch (error) {
        console.log(error)
    }
}

/** Liste des services, triés par date de création. */
export async function fetchServices() {
    try {
        const { data, error } = await supabase
            .from("services")
            .select("*")
            .order("created_at", { ascending: true })
        if (error) throw error
        return data
    } catch (error) {
        console.log(error)
    }
}
