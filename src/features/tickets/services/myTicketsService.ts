// Couche service — tickets assignés à l'utilisateur courant, pour le
// widget de dashboard (docs/Architecture_Feature.pdf §5).
import { supabase } from "@/integrations/supabase/client"
import type { Ticket } from "../components/types"

/** Statuts qui comptent comme « encore à traiter ». */
const OPEN_STATUSES = ["ouvert", "en_cours"]

/**
 * Colonnes strictement nécessaires à une ligne de module. Partagées par
 * les deux requêtes pour qu'elles ne divergent pas.
 */
const ROW_COLUMNS = "id, title, status, priority, category, created_at"

/**
 * Tickets ouverts assignés à cet utilisateur, du plus récent au plus
 * ancien.
 *
 * Requête dédiée plutôt que réutilisation de `fetchTickets()` : celle-ci
 * ramène TOUS les tickets avec leurs deux jointures de profil, ce qui
 * est le bon compromis pour la page Tickets mais pas pour une carte du
 * dashboard, chargée à chaque ouverture de l'application.
 */
export async function fetchMyOpenTickets(
    userId: string,
    limit: number
): Promise<Ticket[]> {
    const { data, error } = await supabase
        .from("ticket_table")
        .select(ROW_COLUMNS)
        .eq("assigned_to", userId)
        .in("status", OPEN_STATUSES)
        .order("created_at", { ascending: false })
        .limit(limit)

    if (error) throw error
    return (data ?? []) as Ticket[]
}

/**
 * Les tickets **nouveaux** : ouverts et assignés à personne.
 *
 * « Nouveau » se définit ici par *ouvert et non assigné*, et non par la
 * table `new_ticket` — celle-ci existe en base mais n'est référencée
 * nulle part dans le front, s'en servir reviendrait à réveiller un
 * schéma dont plus rien ne garantit qu'il est alimenté.
 *
 * `en_cours` est exclu volontairement : un ticket qu'on a commencé à
 * traiter n'est plus à prendre, même si personne ne se l'est formellement
 * attribué.
 *
 * Les plus anciens d'abord, à l'inverse des tickets assignés : dans une
 * file d'attente, c'est celui qui patiente depuis le plus longtemps qui
 * demande une réponse.
 */
export async function fetchNewTickets(limit: number): Promise<Ticket[]> {
    const { data, error } = await supabase
        .from("ticket_table")
        .select(ROW_COLUMNS)
        .is("assigned_to", null)
        .eq("status", "ouvert")
        .order("created_at", { ascending: true })
        .limit(limit)

    if (error) throw error
    return (data ?? []) as Ticket[]
}
