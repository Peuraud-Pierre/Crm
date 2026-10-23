import { supabase } from "@/integrations/supabase/client"
import { type Event_creation, type EventDateRange } from "@/features/crm/types/calendar"
import { SLOT_BLOCKING_TYPES } from "@/features/crm/utils/eventTypes"

// Jointures réduites aux champs lus par l'UI : `clientProfile.{id,nom}` (le
// clic ouvre la fiche, qui recharge le client complet via fetchOneClient) et
// `customer.{id,user_id,full_name}` (owner + regroupement par commercial).
// `client_crm(*)` ramenait le brief de chaque client pour chaque RDV.
const EVENT_SELECT = `*, clientProfile:client_crm!left(id, nom), customer:profiles!event_calendar_customer_fkey!left(id, user_id, full_name)`

export async function logClientActivity(
    clientId: string,
    ownerId: string | null,
    title: string,
    content: string
): Promise<void> {
    const { error } = await supabase.from("Client_activite").insert([
        {
            client: clientId,
            date: new Date().toISOString(),
            title,
            content,
            owner: ownerId,
        },
    ])
    if (error) console.error("❌ Erreur log activité client:", error)
}

export async function fetchOneCalendarEvent(
    eventId: string
): Promise<Event_creation | null> {
    const { data, error } = await supabase
        .from("Event_calendar")
        .select(EVENT_SELECT)
        .eq("id", eventId)
        .single()
    if (error || !data) return null
    // Cast : le hint de FK dans le select empêche Supabase d'inférer le type
    // des lignes (ParserError), même contournement que fetch_calendar_event.
    const row = data as unknown as Record<string, unknown>
    return {
        ...row,
        debut: row.debut || new Date().toISOString(),
        fin: row.fin || new Date().toISOString(),
        participants: row.client || "",
    } as Event_creation
}

export async function fetchBusySlots(
    targetId: string,
    dayStartIso: string,
    dayEndIso: string,
    excludeId?: string
) {
    let query = supabase
        .from("Event_calendar")
        // `client` (nom du participant) sert à nommer le conflit à l'utilisateur.
        .select(`id, debut, fin, nom, client`)
        .eq("customer", targetId)
        .in("nom", [...SLOT_BLOCKING_TYPES])
        // Les RDV Amelia en attente de confirmation ne bloquent pas le créneau.
        // .filter() et non .eq() : `confirmed` existe en DB mais manque dans les
        // types Supabase générés (même contournement que `source`).
        .filter("confirmed", "eq", true)
        .gte("debut", dayStartIso)
        .lte("debut", dayEndIso)

    if (excludeId) query = query.neq("id", excludeId)

    return query
}

/**
 * Événements d'un commercial sur une journée, pour la grille de la modale de
 * création/édition. L'agenda (vues jour/année) ne charge que le commercial
 * filtré : quand on choisit un autre commercial dans la modale, ses RDV ne
 * sont pas en mémoire et la grille paraît vide alors que la détection de
 * conflit, elle, interroge la base. Cette requête comble l'écart.
 */
export async function fetchOwnerDayEvents(
    ownerId: string,
    dayStartIso: string,
    dayEndIso: string
) {
    return supabase
        .from("Event_calendar")
        .select("id, nom, debut, fin, client, customer, description")
        .eq("customer", ownerId)
        .gte("debut", dayStartIso)
        .lte("debut", dayEndIso)
        .order("debut", { ascending: true })
}

/**
 * Confirme un RDV en attente : n'écrit QUE `confirmed` (et `updated_at`).
 *
 * Ne pas passer par `updateCalendarEvent` pour ça : elle réécrit toutes les
 * colonnes (dont `customer`), et un événement chargé depuis la base n'a pas
 * de champ `owner` — la confirmation effaçait le commercial du RDV.
 * Réécrire debut/fin à l'identique déclencherait aussi inutilement le
 * trigger de reprogrammation.
 *
 * Confirmer compte le RDV comme CRÉÉ par celui qui confirme, ce jour-là :
 * `confirmed_by`, `creator_id` et `created_at` sont posés côté base par
 * trg_stamp_event_confirmation, avec auth.uid() et seulement au passage
 * false → true — le client ne peut ni les choisir ni les réécrire en
 * confirmant une seconde fois. `creator_id` est relu pour l'état local.
 */
export async function confirmCalendarEvent(
    id: string
): Promise<{ id: string; customer: string | null; creator_id: string | null }[]> {
    const { data, error } = await supabase
        .from("Event_calendar")
        // updated_at explicite : les workers Apple (push) se basent dessus
        // pour repérer une modification.
        .update({ confirmed: true, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select("id, customer, creator_id")
    if (error) throw error
    return data ?? []
}

/**
 * Tous les RDV d'un client (confirmés et en attente), pour la fiche client.
 *
 * Indépendant de `CRMContext.events` : l'agenda n'y charge qu'une fenêtre de
 * dates, alors que la fiche (et son export RGPD) a besoin de l'historique
 * complet du client. Les RDV en attente y figurent car c'est depuis la fiche
 * que le commercial décide de confirmer.
 */
export async function fetchClientEvents(clientId: string) {
    return supabase
        .from("Event_calendar")
        .select(EVENT_SELECT)
        .eq("id_client", clientId)
        .order("debut", { ascending: false })
}

export async function fetchCalendarEvents(
    ownerId?: string,
    range?: EventDateRange
) {
    let query = supabase
        .from("Event_calendar")
        .select(EVENT_SELECT)
        // Les RDV Amelia non confirmés sont inclus : l'agenda les affiche en
        // pointillé (cf. pendingEventClass) pour montrer la date demandée par
        // le prospect avant que le client sorte de « RDV à confirmer ».
        // Ils ne bloquent en revanche pas les créneaux (cf. fetchBusySlots).
        .order("debut", { ascending: true })

    if (ownerId && ownerId !== "all") query = query.eq("customer", ownerId)
    // Sans plage : tout l'historique (analytics, création hors agenda).
    if (range) query = query.gte("debut", range.from).lt("debut", range.to)

    return query
}

export async function createCalendarEvent(payload: {
    customer: string | null
    nom?: string | null
    id_client?: string | null
    debut?: string | null
    fin: string | null | undefined
    client?: string | null
    lieu?: string | null
    description?: string | null
    creator_id: string | null
}) {
    const { data, error } = await supabase
        .from("Event_calendar")
        .insert([payload])
        .select()
        .single()
    if (error) throw error
    return data
}

export async function moveClientToPipelineColumn(
    clientId: string,
    column: number
): Promise<void> {
    await supabase.from("client_crm").update({ collum: column }).eq("id", clientId)
}

export async function fetchEventBeforeDelete(id: string) {
    const { data } = await supabase
        .from("Event_calendar")
        .select("id_client, nom, debut, fin")
        .eq("id", id)
        .single()
    return data
}

export async function deleteCalendarEvent(id: string): Promise<void> {
    await supabase.from("Event_calendar").delete().eq("id", id)
}

export async function updateCalendarEvent(
    id: string,
    payload: {
        nom?: string | null
        debut?: string | null
        fin: string | null | undefined
        lieu?: string | null
        description?: string | null
        client?: string | null
        id_client?: string | null
        customer: string | null
        show?: boolean | null
        why?: string | null
        confirmed?: boolean | null
    }
): Promise<{ id: string; customer: string | null }[]> {
    // `.select()` est indispensable : un UPDATE bloqué par une policy RLS
    // (clause USING) ne renvoie PAS d'erreur, il affecte simplement 0 ligne.
    // L'appelant doit vérifier que le tableau retourné n'est pas vide.
    const { data, error } = await supabase
        .from("Event_calendar")
        // `confirmed` existe en DB mais manque dans les types Supabase générés
        // (même contournement que `fetchBusySlots`/`fetchClientPendingEvents`).
        .update(payload as never)
        .eq("id", id)
        .select("id, customer")
    if (error) throw error
    return data ?? []
}
