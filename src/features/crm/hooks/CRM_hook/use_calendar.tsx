import { useAuth } from "@/features/auth/hooks/useAuth"
import { subscribeToTable } from "@/features/crm/services/realtimeService"
import type { EventCalendarRow } from "@/features/crm/services/statsService"
import { useCallback, useEffect, useMemo, useState, useRef } from "react"
import {
    hashKey,
    keepPreviousData,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query"
import { useAppleAuth } from "@/features/calendar-integrations/apple/hooks/useAppleAuth"
import { useAmeliaSync } from "@/features/calendar-integrations/amelia"
import { format } from "date-fns"
import { toast } from "sonner"
import { safeDate } from "@/features/crm/utils/calendarConstants"
import {
    AMELIA_RDV_TYPES,
    AMELIA_BLOCK_TYPES,
} from "@/features/crm/utils/eventTypes"
import { type Event_creation, type EventDateRange } from "../../types/calendar"
import * as calendarEventService from "@/features/crm/services/calendarEventService"
import { getCustomerUserId } from "@/features/crm/utils/invariants"

/** Événement qui occupe déjà le créneau demandé (cf. findSlotConflict). */
export interface SlotConflict {
    id: string
    nom: string | null
    debut: string
    fin: string
    client: string | null
}

/**
 * Commercial à ÉCRIRE dans `Event_calendar.customer`.
 *
 * `owner` n'existe que sur les événements construits par le formulaire ; un
 * événement chargé depuis la base porte le commercial dans `customer`
 * (jointure profiles). Sans ce repli, toute mise à jour d'un événement brut
 * (confirmation, show/no-show…) effaçait le commercial du RDV.
 */
const resolveEventOwner = (event: Event_creation): string | null =>
    event.owner ?? getCustomerUserId(event.customer) ?? null

// --- Types re-exportés depuis le fichier de types partagés ---
export type {
    CRMUser as EventCustomerObject,
    EventCustomerRef,
    Event_creation,
} from "@/features/crm/types"

// Natures de RDV considérées « catégorie Amelia » : seules celles-ci sont
// propagées vers Amelia (create/update). Les events internes
// ("appel", "Non Disponible", "divers"…) ne doivent jamais créer de créneau
// côté Amelia. Doit rester aligné avec ameliaServiceMapping du bridge Go
// (service IDs 1/2/3).
const isAmeliaCategory = (nom?: string | null): boolean =>
    !!nom && AMELIA_RDV_TYPES.has(nom)

// « le 17/06/2026 de 10:30 à 11:00 » pour le contenu des activités client.
const formatRdvPeriod = (debut?: string | null, fin?: string | Date | null) => {
    const start = safeDate(debut)
    if (!start) return ""
    const end = safeDate(fin instanceof Date ? fin.toISOString() : fin)
    return end
        ? `le ${format(start, "dd/MM/yyyy")} de ${format(start, "HH:mm")} à ${format(end, "HH:mm")}`
        : `le ${format(start, "dd/MM/yyyy")} à ${format(start, "HH:mm")}`
}

// Natures propagées vers Amelia comme simple "block" (créneau rendu indisponible),
// sans création d'appointment ni de client. Aujourd'hui : les indisponibilités.
const isAmeliaBlock = (nom?: string | null): boolean =>
    !!nom && AMELIA_BLOCK_TYPES.has(nom)

// Tout ce qui doit être synchronisé vers Amelia (RDV OU block).
const shouldSyncToAmelia = (nom?: string | null): boolean =>
    isAmeliaCategory(nom) || isAmeliaBlock(nom)

/**
 * Cache TanStack des événements de l'agenda : une entrée par (commercial,
 * plage). Revenir sur un mois déjà vu est instantané, et les appelants qui
 * demandent la même portée (agenda, analytics…) partagent une seule requête.
 */
const CALENDAR_EVENTS_KEY = ["crm", "calendar-events"] as const

interface EventsParams {
    ownerId?: string
    range?: EventDateRange
}

const eventsKey = (params: EventsParams | null) => [
    ...CALENDAR_EVENTS_KEY,
    params?.ownerId || "all",
    params?.range?.from ?? null,
    params?.range?.to ?? null,
]

async function fetchEventsRows(params: EventsParams): Promise<Event_creation[]> {
    const { data, error } = await calendarEventService.fetchCalendarEvents(
        params.ownerId,
        params.range
    )
    if (error) throw error
    // Cast : le hint de FK dans le select empêche Supabase d'inférer
    // le type des lignes (ParserError) ; on type explicitement.
    const rows = (data ?? []) as unknown as Array<Record<string, unknown>>
    return rows.map((evt) => ({
        ...evt,
        participants: evt.client || "",
        debut: evt.debut || new Date().toISOString(),
        fin: evt.fin || new Date().toISOString(),
    })) as Event_creation[]
}

const NO_EVENTS: Event_creation[] = []

export function useEvent() {
    const { user } = useAuth()
    const { syncEvent } = useAppleAuth()
    const { syncToAmelia } = useAmeliaSync()
    const queryClient = useQueryClient()
    // Portée demandée par le dernier fetch_calendar_event (null = jamais
    // appelé : les mises à jour optimistes vont alors dans une entrée vide).
    const [params, setParams] = useState<EventsParams | null>(null)
    const queryKey = useMemo(() => eventsKey(params), [params])
    // Lus par le realtime et les mutations, mémoïsés une fois pour toutes.
    const activeKeyRef = useRef(queryKey)
    activeKeyRef.current = queryKey
    const currentFilterRef = useRef<string | "all">("all")

    const { data: events = NO_EVENTS } = useQuery({
        queryKey,
        queryFn: () => fetchEventsRows(params ?? {}),
        enabled: !!user?.user_id && params !== null,
        // Au changement de mois, l'ancienne fenêtre reste affichée le temps
        // du chargement au lieu d'une grille vide.
        placeholderData: keepPreviousData,
    })

    // Remplace l'ancien useState : applique la modif (optimiste ou realtime)
    // à la portée affichée, et marque les autres portées en cache comme
    // périmées — elles se rechargeront en arrière-plan quand on y reviendra.
    const setEvents = useCallback(
        (updater: (prev: Event_creation[]) => Event_creation[]) => {
            const active = activeKeyRef.current
            queryClient.setQueryData<Event_creation[]>(active, (prev) =>
                updater(prev ?? [])
            )
            const activeHash = hashKey(active)
            void queryClient.invalidateQueries({
                queryKey: CALENDAR_EVENTS_KEY,
                predicate: (q) => q.queryHash !== activeHash,
                refetchType: "none",
            })
        },
        [queryClient]
    )

    // Journalise une entrée dans l'activité du client lié (visible dans la
    // fiche client, propagée en live par la subscription Realtime de
    // useActivites). Fire-and-forget : ne bloque jamais l'action calendrier.
    const logClientActivity = useCallback(
        async (
            clientId: string | null | undefined,
            title: string,
            content: string
        ) => {
            if (!clientId) return
            await calendarEventService.logClientActivity(
                clientId,
                user?.user_id ?? null,
                title,
                content
            )
        },
        [user?.user_id]
    )

    // Stable via useCallback pour pouvoir être ajouté aux deps du useEffect Realtime.
    const fetchOneEvent = useCallback(
        calendarEventService.fetchOneCalendarEvent,
        []
    )

    // Renvoie l'événement qui occupe déjà le créneau du commercial ciblé, ou
    // null. Nommer le conflit est indispensable : en vue jour/année l'agenda
    // ne charge que le commercial filtré, donc un refus sur un AUTRE commercial
    // arrivait avec une grille vide et paraissait injustifié.
    const findSlotConflict = useCallback(
        async (
            targetId: string,
            newStart: string,
            newEnd: string,
            excludeId?: string
        ): Promise<SlotConflict | null> => {
            // Sans owner (uuid), `.eq("customer", "")` ferait échouer la requête
            // Postgres (cast "" → uuid : code 22P02). Pas d'owner ⇒ rien à vérifier.
            if (!targetId) return null

            const dayStart = new Date(newStart)
            dayStart.setHours(0, 0, 0, 0)
            const dayEnd = new Date(newStart)
            dayEnd.setHours(23, 59, 59, 999)

            const { data, error } = await calendarEventService.fetchBusySlots(
                targetId,
                dayStart.toISOString(),
                dayEnd.toISOString(),
                excludeId
            )
            if (error || !data) return null

            const proposedStart = new Date(newStart).getTime()
            const proposedEnd = new Date(newEnd).getTime()

            const hit = data.find((evt) => {
                const existStart = safeDate(evt.debut)?.getTime()
                const existEnd = safeDate(evt.fin)?.getTime()
                if (!existStart || !existEnd) return false
                return proposedStart < existEnd && proposedEnd > existStart
            })
            if (!hit) return null
            return {
                id: hit.id,
                nom: hit.nom ?? null,
                debut: hit.debut ?? "",
                fin: hit.fin ?? "",
                client: (hit as { client?: string | null }).client ?? null,
            }
        },
        []
    )

    const isSlotBusy = useCallback(
        async (
            targetId: string,
            newStart: string,
            newEnd: string,
            excludeId?: string
        ) =>
            (await findSlotConflict(targetId, newStart, newEnd, excludeId)) !==
            null,
        [findSlotConflict]
    )

    // Change la portée affichée (`events`) et attend son chargement. Les
    // portées déjà en cache et fraîches ne refont pas de requête ; les
    // réponses d'une ancienne portée vont dans leur propre entrée de cache,
    // elles ne peuvent plus écraser la portée courante.
    const fetch_calendar_event = useCallback(
        async (ownerId?: string, range?: EventDateRange) => {
            if (!user?.user_id) return
            currentFilterRef.current = ownerId || "all"
            const next: EventsParams = { ownerId, range }
            activeKeyRef.current = eventsKey(next)
            setParams(next)
            try {
                await queryClient.fetchQuery({
                    queryKey: eventsKey(next),
                    queryFn: () => fetchEventsRows(next),
                })
            } catch (error) {
                console.error("❌ Erreur fetch events:", error)
            }
        },
        [user?.user_id, queryClient]
    )

    useEffect(() => {
        if (!user?.user_id) return
        const unsubscribe = subscribeToTable<EventCalendarRow>(
            `realtime-events-global`,
            "Event_calendar",
            undefined,
            async ({ eventType, newRow, oldRow }) => {
                const filter = currentFilterRef.current
                if (eventType === "DELETE") {
                    setEvents((prev) => prev.filter((e) => e.id !== oldRow.id))
                    return
                }
                if (!newRow.id) return
                const newId = newRow.id
                const eventOwner = newRow.customer
                if (filter !== "all" && eventOwner !== filter) {
                    // L'event n'appartient plus (réassignation d'owner) ou pas
                    // (création pour un autre commercial) à la vue filtrée
                    // courante. On le RETIRE localement au lieu de l'ignorer :
                    // sinon la mise à jour optimiste l'aurait laissé affiché à
                    // tort dans la vue filtrée (auparavant, le refetch complet
                    // l'excluait via .eq("customer", filter)).
                    setEvents((prev) => prev.filter((e) => e.id !== newId))
                    return
                }
                const fullEvent = await fetchOneEvent(newId)
                if (!fullEvent) return
                setEvents((prev) => {
                    const index = prev.findIndex((e) => e.id === fullEvent.id)
                    if (index !== -1) {
                        const updated = [...prev]
                        updated[index] = fullEvent
                        return updated
                    }
                    return [...prev, fullEvent]
                })
            }
        )

        return unsubscribe
    }, [user?.user_id, fetchOneEvent, setEvents])

    // 🔹 CRUD Action : CREATE
    const create_event_calendar = useCallback(
        async (event: Event_creation) => {
            const tempId = `temp-${Date.now()}`
            const owner = event.owner ?? user?.user_id ?? null
            const fin =
                event.fin instanceof Date ? event.fin.toISOString() : event.fin

            setEvents((prev) => [
                ...prev,
                {
                    ...event,
                    id: tempId,
                    owner,
                    fin,
                    participants: event.participants ?? "",
                    debut: event.debut || new Date().toISOString(),
                },
            ])

            try {
                const data = await calendarEventService.createCalendarEvent({
                    customer: owner,
                    nom: event.nom,
                    id_client: event.id_client || null,
                    debut: event.debut,
                    fin,
                    client: event.participants,
                    lieu: event.lieu,
                    description: event.description,
                    creator_id: event.creator_id || user?.user_id || null,
                })

                setEvents((prev) =>
                    prev.map((evt) =>
                        evt.id === tempId ? { ...evt, id: data.id } : evt
                    )
                )
                await syncEvent(data.id, "create", owner ?? "")

                // Propagation Amelia : RDV (→ appointment) ou "Non Disponible"
                // (→ block). Fire-and-forget (erreurs avalées dans useAmeliaSync).
                if (shouldSyncToAmelia(event.nom)) {
                    await syncToAmelia("create", {
                        id: data.id,
                        name: event.nom,
                        startDateTime: event.debut,
                        endDateTime: fin,
                        owner,
                        // Le client n'est joint que pour un vrai RDV (appointment).
                        customer: isAmeliaCategory(event.nom)
                            ? {
                                  firstName: event.participants || undefined,
                                  email: event.mail?.[0] || undefined,
                              }
                            : undefined,
                    })
                }

                // 🎯 RDV → déplacer le client dans la colonne pipeline correspondante
                if (event.id_client) {
                    const isAchat =
                        event.nom === "rdv physique achat"
                    const isDecouverte =
                        event.nom === "rdv physique decouverte" ||
                        event.nom === "rdv decouverte visio"
                    if (isAchat || isDecouverte) {
                        await calendarEventService.moveClientToPipelineColumn(
                            event.id_client,
                            isAchat ? 4 : 3
                        )
                    }
                }

                // Mail de confirmation : si le RDV a une fiche client, c'est le
                // trigger call_go_api_on_false (post_rdv_mail) qui l'envoie — un
                // envoi ici le doublait. Sans fiche, l'email saisi n'existe pas en
                // base : seul le front peut l'envoyer (pas de brief → "fr").
                if (
                    !event.id_client &&
                    event.mail &&
                    event.mail.length > 0 &&
                    event.nom !== "Non Disponible"
                ) {
                    const dateObj = new Date(event.debut)
                    fetch("https://info.nokk-project.example/no_repleid_rdv", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            client_email: event.mail,
                            client_nom: event.participants || "Client",
                            date_rdv: format(dateObj, "dd/MM/yyyy"),
                            heure_rdv: format(dateObj, "HH:mm").replace(":", "h"),
                            owner,
                            langue: "fr",
                            type_rdv: event.nom || "autre",
                        }),
                    })
                }

                // 📝 Trace dans l'activité du client lié
                await logClientActivity(
                    event.id_client,
                    "RDV planifié",
                    `${event.nom || "RDV"} ${formatRdvPeriod(event.debut, fin)}`
                )
            } catch (error) {
                setEvents((prev) => prev.filter((evt) => evt.id !== tempId))
                console.error("❌ Erreur création:", error)
            }
        },
        [syncEvent, syncToAmelia, logClientActivity, user?.user_id, setEvents]
    )

    const deleteEvent = useCallback(
        async (id: string) => {
            try {
                // Récupère les infos avant suppression pour tracer l'activité
                // du client lié (id_client n'est plus accessible après le delete).
                const evtToDelete =
                    await calendarEventService.fetchEventBeforeDelete(id)

                await calendarEventService.deleteCalendarEvent(id)
                await syncEvent(id, "delete", user?.user_id ?? "")

                // 📝 Trace dans l'activité du client lié
                if (evtToDelete?.id_client) {
                    await logClientActivity(
                        evtToDelete.id_client,
                        "RDV supprimé",
                        `${evtToDelete.nom || "RDV"} ${formatRdvPeriod(evtToDelete.debut, evtToDelete.fin)}`
                    )
                }
                // Propagation vers Amelia (bridge Go). Seul l'id est utilisé par
                // la route DELETE /crm/delete-from-wp/:id ; name/dates sont des
                // placeholders. Fire-and-forget : n'altère pas la suppression CRM.
                await syncToAmelia("delete", {
                    id,
                    name: "",
                    startDateTime: "",
                    endDateTime: "",
                    owner: user?.user_id ?? undefined,
                })
                setEvents((prev) => prev.filter((e) => e.id !== id))
            } catch (e) {
                console.error(e)
            }
        },
        [syncEvent, syncToAmelia, logClientActivity, user?.user_id, setEvents]
    )

    // 🔹 Confirmation d'un RDV Amelia en attente : n'écrit que `confirmed`.
    // Séparé de update_Event, qui réécrit toutes les colonnes : c'est par là
    // que la confirmation effaçait le commercial (customer = NULL) et cassait
    // la synchro Apple, le mail de confirmation et l'affichage dans l'agenda.
    const confirm_event = useCallback(
        async (event: Event_creation) => {
            if (!event.id || !user?.user_id) return
            const owner = resolveEventOwner(event)
            let updatedRows: Awaited<
                ReturnType<typeof calendarEventService.confirmCalendarEvent>
            >
            try {
                updatedRows = await calendarEventService.confirmCalendarEvent(
                    event.id
                )
            } catch (confirmError) {
                console.error("❌ confirm_event refusé:", confirmError)
                const message =
                    confirmError instanceof Error
                        ? confirmError.message
                        : String(confirmError)
                toast.error(`Confirmation refusée : ${message}`)
                return
            }
            if (updatedRows.length === 0) {
                console.error(
                    "❌ confirm_event : 0 ligne modifiée (RLS ou id introuvable)",
                    { id: event.id, customer: owner }
                )
                toast.error(
                    "Confirmation non enregistrée : droits insuffisants sur cet événement (RLS)"
                )
                return
            }

            // creator_id relu en base : si quelqu'un a confirmé juste avant,
            // le crédit lui reste (trg_stamp_event_confirmation).
            const creatorId = updatedRows[0].creator_id
            setEvents((prev) =>
                prev.map((e) =>
                    e.id === event.id
                        ? { ...e, confirmed: true, creator_id: creatorId }
                        : e
                )
            )

            // Le setter du client (`client_crm.customer`) = celui qui confirme :
            // posé côté base par le trigger trg_set_client_setter_on_confirm
            // (SECURITY DEFINER — la RLS de client_crm bloquait l'écriture
            // depuis le front, sans erreur).

            // Un RDV pris sur Amelia n'a jamais été poussé vers Apple (le
            // webhook Go écrit directement en base) : on demande une création,
            // le backend la traite comme un upsert. Routé sur le commercial du
            // RDV, pas sur la personne qui clique.
            await syncEvent(event.id, "create", owner ?? user?.user_id ?? "")

            await logClientActivity(
                event.id_client,
                "RDV confirmé",
                `${event.nom || "RDV"} ${formatRdvPeriod(event.debut, event.fin)}`
            )
            toast.success("Rendez-vous confirmé")
        },
        [syncEvent, logClientActivity, user?.user_id, setEvents]
    )

    const update_Event = useCallback(
        async (event: Event_creation) => {
            try {
                const owner = resolveEventOwner(event)
                // Diagnostic : à comparer avec le log "✅ écrit en DB" — si les
                // deux diffèrent, un trigger/policy côté DB réécrit la valeur.
                console.log("📝 update_Event customer envoyé:", {
                    id: event.id,
                    owner,
                })
                let updatedRows: { id: string; customer: string | null }[]
                try {
                    updatedRows =
                        await calendarEventService.updateCalendarEvent(
                            event.id ?? "",
                            {
                                nom: event.nom,
                                debut: event.debut,
                                fin:
                                    event.fin instanceof Date
                                        ? event.fin.toISOString()
                                        : event.fin,
                                lieu: event.lieu,
                                description: event.description,
                                client: event.participants,
                                id_client: event.id_client,
                                customer: owner,
                                show: event.show,
                                why: event.why,
                                confirmed: event.confirmed,
                            }
                        )
                } catch (updateError) {
                    console.error("❌ update_Event refusé:", updateError)
                    const message =
                        updateError instanceof Error
                            ? updateError.message
                            : ((updateError as { message?: string })?.message ??
                              String(updateError))
                    toast.error(`Modification refusée : ${message}`)
                    return
                }
                if (updatedRows.length === 0) {
                    console.error(
                        "❌ update_Event : 0 ligne modifiée (RLS ou id introuvable)",
                        { id: event.id, customer: owner }
                    )
                    toast.error(
                        "Modification non enregistrée : droits insuffisants sur cet événement (RLS)"
                    )
                    return
                }
                // Trace de diagnostic : la valeur `customer` telle que persistée
                // en DB. Si elle est correcte ici mais que l'UI reste sur
                // l'ancien commercial, quelque chose réécrit la ligne après coup.
                console.log("✅ update_Event écrit en DB:", updatedRows[0])

                // 🎯 2. L'AJOUT POUR LE CLIENT : Update de la colonne show
                if (event.id_client && event.show === false) {
                    await calendarEventService.moveClientToPipelineColumn(
                        event.id_client,
                        8
                    )
                }

                if (event.id)
                    await syncEvent(event.id, "update", owner ?? user?.user_id ?? "")

                // Propagation Amelia : RDV (appointment) ou "Non Disponible" (block).
                if (event.id && shouldSyncToAmelia(event.nom)) {
                    const finIso =
                        event.fin instanceof Date
                            ? event.fin.toISOString()
                            : event.fin
                    await syncToAmelia("update", {
                        id: event.id,
                        name: event.nom,
                        startDateTime: event.debut,
                        endDateTime: finIso,
                        owner: owner ?? user?.user_id ?? undefined,
                        customer: isAmeliaCategory(event.nom)
                            ? {
                                  firstName: event.participants || undefined,
                                  email: event.mail?.[0] || undefined,
                              }
                            : undefined,
                    })
                }

                // Mise à jour optimiste locale au lieu d'un re-scan complet de la
                // table (2 joins) à chaque édition / drag / resize. On ne patche que
                // les champs édités pour ne pas écraser les relations jointes
                // (clientProfile/customer) ; le channel realtime réconcilie la
                // version serveur si nécessaire.
                const filter = currentFilterRef.current
                const newOwner = owner
                if (filter !== "all" && newOwner !== filter) {
                    // Vue filtrée (jour/année) + réassignation de l'owner hors du
                    // filtre courant : l'event ne doit plus apparaître ici. On le
                    // retire immédiatement (sans attendre l'écho realtime), comme le
                    // faisait l'ancien refetch .eq("customer", filter).
                    setEvents((prev) => prev.filter((e) => e.id !== event.id))
                } else {
                    setEvents((prev) =>
                        prev.map((e) =>
                            e.id === event.id
                                ? {
                                      ...e,
                                      nom: event.nom,
                                      debut: event.debut,
                                      fin:
                                          event.fin instanceof Date
                                              ? event.fin.toISOString()
                                              : event.fin,
                                      lieu: event.lieu,
                                      description: event.description,
                                      participants: event.participants,
                                      id_client: event.id_client,
                                      owner: owner ?? e.owner,
                                      show: event.show,
                                      why: event.why,
                                      confirmed: event.confirmed,
                                  }
                                : e
                        )
                    )
                }
            } catch (e) {
                console.error(e)
            }
        },
        [syncEvent, syncToAmelia, user?.user_id, setEvents]
    )

    return useMemo(
        () => ({
            events,
            create_event_calendar,
            fetch_calendar_event,
            deleteEvent,
            update_Event,
            confirm_event,
            isSlotBusy,
            findSlotConflict,
        }),
        [
            events,
            create_event_calendar,
            fetch_calendar_event,
            deleteEvent,
            update_Event,
            confirm_event,
            isSlotBusy,
            findSlotConflict,
        ]
    )
}
