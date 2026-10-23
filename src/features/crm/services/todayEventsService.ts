// Couche service — rendez-vous du jour de l'utilisateur courant, pour le
// widget de dashboard (docs/Architecture_Feature.pdf §5).
import { supabase } from "@/integrations/supabase/client"

/** Un rendez-vous, réduit à ce que la carte du dashboard affiche. */
export interface TodayEvent {
    id: string
    nom: string | null
    debut: string | null
    fin: string | null
    lieu: string | null
    client: string | null
}

/**
 * Rendez-vous de l'utilisateur dont le début tombe dans l'intervalle
 * donné, par ordre chronologique.
 *
 * Les bornes sont calculées par l'appelant et passées en ISO : la journée
 * « du jour » commence à minuit dans le fuseau de l'utilisateur, ce que
 * la base ne peut pas deviner.
 *
 * Requête dédiée plutôt que `fetchCalendarEvents()`, qui ramène tout
 * l'agenda avec ses jointures client et profil — trop pour une carte
 * chargée à chaque ouverture de l'application.
 */
export async function fetchTodayEvents(
    userId: string,
    fromIso: string,
    toIso: string
): Promise<TodayEvent[]> {
    const { data, error } = await supabase
        .from("Event_calendar")
        .select("id, nom, debut, fin, lieu, client")
        .eq("customer", userId)
        // Même règle que l'agenda : pas de RDV en attente de confirmation.
        .filter("confirmed", "eq", true)
        .gte("debut", fromIso)
        .lt("debut", toIso)
        .order("debut", { ascending: true })

    if (error) throw error
    return (data ?? []) as TodayEvent[]
}
