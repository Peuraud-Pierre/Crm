/**
 * Couche service de la feature Tournée — seul point de contact Supabase.
 *
 * Lecture seule : le jeu est une projection des données CRM existantes
 * (Event_calendar + Client_activite + profiles), aucune table dédiée,
 * aucune écriture.
 */
import { supabase } from "@/integrations/supabase/client"
import type { TourneeEventRow, TourneeProfile } from "../types"

/** Ligne brute d'une interaction fiche client (Client_activite). */
interface ActiviteRow {
    id: string
    title: string | null
    date: string | null
    owner: string | null
    client: string | null
}

/**
 * Actions CRM de la période (bornes ISO, [start, end[), depuis les DEUX
 * sources de vérité :
 *  - Event_calendar : RDV et événements du calendrier (created_at = ordre
 *    des "tours de jeu", même source que les stats analytics) ;
 *  - Client_activite : interactions saisies sur la fiche client ("Nouvelle
 *    interaction" → Appel, Message, Mail, Qualification), stockées avec
 *    title = type et owner = setter. Sans elle, un appel loggé sur une
 *    fiche ne comptait pas dans le jeu.
 * Les deux flux sont normalisés au même format et rejoués chronologiquement.
 */
export async function fetchTourneeEvents(
    rangeStart: string,
    rangeEnd: string
): Promise<TourneeEventRow[]> {
    const [events, activites] = await Promise.all([
        supabase
            .from("Event_calendar")
            .select("id, nom, debut, created_at, creator_id, show, id_client")
            .gte("created_at", rangeStart)
            .lt("created_at", rangeEnd)
            .not("creator_id", "is", null)
            .order("created_at", { ascending: true })
            .limit(10000),
        supabase
            .from("Client_activite")
            .select("id, title, date, owner, client")
            .gte("date", rangeStart)
            .lt("date", rangeEnd)
            .not("owner", "is", null)
            .order("date", { ascending: true })
            .limit(10000),
    ])

    if (events.error) throw events.error
    if (activites.error) throw activites.error

    const activityRows: TourneeEventRow[] = (
        (activites.data ?? []) as ActiviteRow[]
    ).map((a) => ({
        id: a.id,
        nom: a.title, // "Appel", "Message"… — normalisé en minuscules par le moteur
        debut: a.date,
        created_at: a.date,
        creator_id: a.owner,
        show: null,
        id_client: a.client,
    }))

    return [...((events.data ?? []) as TourneeEventRow[]), ...activityRows].sort(
        (x, y) => (x.created_at ?? "").localeCompare(y.created_at ?? "")
    )
}

/**
 * Abonnement temps réel : `onChange` est appelé à chaque INSERT/UPDATE/DELETE
 * sur Event_calendar OU Client_activite (les deux sources du jeu).
 * `onStatus(healthy)` reflète la santé de l'abonnement, pour permettre au
 * hook de basculer en polling si le Realtime est KO (table non publiée,
 * service Realtime down, proxy qui coupe le WebSocket…).
 * Retourne la fonction de désabonnement.
 */
export function subscribeToTourneeEvents(
    onChange: () => void,
    onStatus?: (healthy: boolean) => void
): () => void {
    // `removeChannel` fait émettre CLOSED au canal : sans ce drapeau, chaque
    // démontage du plateau écrivait un warn d'échec dans les logs alors que
    // l'abonnement s'était simplement terminé normalement.
    let disposing = false

    const channel = supabase
        .channel("tournee_events_realtime")
        .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "Event_calendar" },
            onChange
        )
        .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "Client_activite" },
            onChange
        )
        .subscribe((status, err) => {
            if (status === "SUBSCRIBED") {
                console.info(
                    "[tournee] Realtime Event_calendar connecté — plateau en direct"
                )
                onStatus?.(true)
                return
            }
            if (disposing) return
            if (
                status === "CHANNEL_ERROR" ||
                status === "TIMED_OUT" ||
                status === "CLOSED"
            ) {
                console.warn(
                    `[tournee] Abonnement Realtime Event_calendar en échec (${status}) — bascule en polling`,
                    err ?? ""
                )
                onStatus?.(false)
            }
        })

    return () => {
        disposing = true
        supabase.removeChannel(channel)
    }
}

/** Profils (nom + avatar) des joueurs présents sur le plateau. */
export async function fetchTourneeProfiles(
    userIds: string[]
): Promise<TourneeProfile[]> {
    if (userIds.length === 0) return []
    const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url")
        .in("user_id", userIds)

    if (error) throw error
    return (data ?? []) as TourneeProfile[]
}
