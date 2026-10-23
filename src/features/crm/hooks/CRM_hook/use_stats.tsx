import { useCallback, useEffect, useMemo, useState } from "react"
import { useCRMContext } from "@/features/crm/context/CRMContext"
import { type Event_creation } from "../../types/calendar"
import { isFerieOrWeekend } from "@/features/crm/utils/calendarConstants"
import { isCountedSource } from "@/features/crm/utils/statsEligibility"
import {
    fetchEventStatsRpc,
    fetchEventStatsFallback,
    countClientsFiltered,
    getClientColumnCounts,
    type CrmEventStatRow,
    type EventCalendarRow,
} from "@/features/crm/services/statsService"

// --- Types re-exportés depuis le fichier de types partagés ---
export type {
    CRMUser as EventCustomerObject,
    EventCustomerRef,
    Event_creation,
} from "@/features/crm/types"

// Seuls les RDV créés depuis le CRM (source = 'crm') — ou confirmés depuis le
// CRM (cf. isCountedSource) — par ces utilisateurs comptent dans les stats de
// génération de RDV et les stats personnelles.
const STATS_ALLOWED_CREATORS = new Set([
    "2c2312cb-1cf3-4c6a-a4c6-c0a363eb9ade",
    "8f93efc7-a3fb-496b-a397-781ae3fc41cf",
    "921e5a2d-1447-4f4c-b893-2f935a996973", // Bastien
    "e8b399a9-61bd-4ee4-b9fe-8334019201e1", // adam
])

type StatsEligibleInput = {
    source?: string | null
    src?: string | null
    created_by?: string | null
    creator_id?: string | null
    confirmed_by?: string | null
}

const isStatsEligible = (event: StatsEligibleInput) =>
    isCountedSource(event) &&
    STATS_ALLOWED_CREATORS.has(event.created_by ?? event.creator_id ?? "")

// --- HOOK UNIQUE ET CENTRALISÉ ---
export function useAnalyticsStats(
    userId: string | null,
    rangeStart: string | null,
    rangeEnd: string | null,
    prevRangeStart: string | null,
    prevRangeEnd: string | null,
    selectedCommercial: string
) {
    // 1. --- ÉTATS ---
    const [eventsStats, setEventsStats] = useState<Event_creation[]>([])
    const [rpcClientStats, setRpcClientStats] = useState<{
        total: number
        leadsCurrent: number
        leadsPrevious: number
    } | null>(null)
    const [pipelineColumnCounts, setPipelineColumnCounts] = useState<Record<number, number> | null>(null)

    const {
        fetchDevisByUser,
        fetch_calendar_event,
        fetch_activite,
    } = useCRMContext()

    // 2. --- FETCH DES STATS D'ÉVÉNEMENTS ---
    // Essaie d'abord le RPC SECURITY DEFINER (bypass RLS, résultat = SQL direct).
    // Si le RPC n'existe pas encore en DB, fallback sur le select direct.
    const fetchEventstats = useCallback(async () => {
        if (!rangeStart || !rangeEnd) return []

        // Couvre la période courante ET la période précédente pour le calcul de tendance
        const effectiveStart = prevRangeStart ?? rangeStart

        console.log("[fetchEventstats] range:", effectiveStart, "→", rangeEnd)

        // Tentative RPC
        const { data: rpcData, error: rpcError } = await fetchEventStatsRpc(
            effectiveStart,
            rangeEnd
        )

        if (!rpcError && rpcData) {
            console.log(
                "[fetchEventstats] RPC ✅ events récupérés:",
                rpcData.length
            )
            const events: Event_creation[] = (rpcData as CrmEventStatRow[])
                .filter((event) => {
                    if (!isStatsEligible(event)) {
                        return false
                    }
                    if (isFerieOrWeekend(event.created_at)) {
                        return false
                    }
                    return true
                })
                .map((event) => ({
                    ...event,
                    debut: event.debut || new Date().toISOString(),
                    fin: event.fin || new Date().toISOString(),
                    participants: event.client || "",
                }))

            events.sort(
                (a, b) =>
                    new Date(a.debut).getTime() - new Date(b.debut).getTime()
            )
            setEventsStats(events)
            return events
        }

        console.warn(
            "[fetchEventstats] RPC ❌ erreur:",
            rpcError?.message,
            "→ fallback select direct"
        )

        const { data, error } = await fetchEventStatsFallback(
            effectiveStart,
            rangeEnd,
            userId
        )

        if (error || !data) {
            console.error(
                "[fetchEventstats] Fallback ❌ erreur:",
                error?.message
            )
            return []
        }

        console.log(
            "[fetchEventstats] Fallback brut:",
            data.length,
            "events récupérés par Supabase avant les filtres JS"
        )

        // UTILISATION D'UN MAP POUR MÉMORISER LE RDV GARDÉ
        const seen = new Map<string, EventCalendarRow>()
        const distinctEvents: Event_creation[] = []
        let skippedDesc = 0
        let skippedWeekend = 0
        let skippedDuplicate = 0
        let skippedCreator = 0

        for (const event of data) {
            // 0. FILTRE CRÉATEUR + SOURCE CRM
            if (!isStatsEligible(event)) {
                skippedCreator++
                continue
            }

            // 1. FILTRE DESCRIPTION
            const desc = (event.description || "").toLowerCase()
            if (
                desc.includes("indisponible") ||
                desc.includes("non disponible")
            ) {
                skippedDesc++
                continue
            }

            // 2. EXCLUSION WEEK-END ET JOURS FÉRIÉS (sur la date de création)
            if (isFerieOrWeekend(event.created_at)) {
                skippedWeekend++
                continue
            }

            // 3. FILTRE DOUBLONS
            const datePart = event.debut ? event.debut.split("T")[0] : "null"

            // ✅ CORRECTIF : ne PLUS retomber sur event.customer (= commercial destinataire,
            //    pas un client). Fallback sur event.id => une ligne sans id_client n'est jamais
            //    fusionnée à tort. + creator_id dans la clé => les 2 poseurs comptés séparément.
            const clientId = event.id_client || event.id
            const key = `${event.creator_id}_${clientId}_${datePart}`

            if (!seen.has(key)) {
                seen.set(key, event)
                distinctEvents.push({
                    ...event,
                    debut: event.debut || new Date().toISOString(),
                    fin: event.fin || new Date().toISOString(),
                    participants: event.client || "",
                } as Event_creation)
            } else {
                skippedDuplicate++
            }
        }

        // 4. TRI FINAL
        distinctEvents.sort(
            (a, b) => new Date(a.debut).getTime() - new Date(b.debut).getTime()
        )

        console.log(
            `📊 Bilan : ${distinctEvents.length} gardés | ${skippedCreator} sautés (créateur/source) | ${skippedDesc} sautés (desc) | ${skippedWeekend} sautés (week-end) | ${skippedDuplicate} sautés (doublons)`
        )

        setEventsStats(distinctEvents)
        return distinctEvents
    }, [rangeStart, rangeEnd, prevRangeStart, userId])
    // 3. --- FETCH GLOBAL (Events + Clients RPC + Pipeline RPC + CRM Context) ---
    useEffect(() => {
        let cancelled = false

        // A. Lancer la récupération des événements (Rdv)
        fetchEventstats()

        // B. Lancer les requêtes globales du contexte CRM (les clients
        // passent par useAnalyticsClients, mis en cache)
        fetch_activite()
        fetch_calendar_event()
        fetchDevisByUser({
            type: "by",
            id: selectedCommercial === "all" ? "*" : selectedCommercial,
        })

        // C. Fetch RPC : Compte des clients
        const countClients = (start: string | null, end: string | null) =>
            countClientsFiltered(userId, start, end)

        Promise.all([
            countClients(null, rangeEnd), // cumulé
            countClients(rangeStart, rangeEnd), // période courante
            prevRangeStart && prevRangeEnd
                ? countClients(prevRangeStart, prevRangeEnd) // période précédente
                : Promise.resolve({ data: null, error: null }),
        ])
            .then(([total, cur, prev]) => {
                if (cancelled) return
                if (!total.error && !cur.error) {
                    setRpcClientStats({
                        total: Number(total.data) || 0,
                        leadsCurrent: Number(cur.data) || 0,
                        leadsPrevious: Number(prev.data) || 0,
                    })
                } else {
                    if (process.env.NODE_ENV !== "production") {
                        console.warn(
                            "[Analytics] count_clients_filtered indisponible :",
                            total.error || cur.error
                        )
                    }
                    setRpcClientStats(null)
                }
            })
            .catch(() => {
                if (!cancelled) setRpcClientStats(null)
            })

        // D. Fetch RPC : Colonnes du pipeline Kanban
        Promise.resolve(getClientColumnCounts(userId))
            .then(({ data, error }) => {
                if (cancelled) return
                if (!error && data) {
                    const map: Record<number, number> = {}
                    data.forEach((row) => {
                        map[row.collum] = Number(row.count) || 0
                    })
                    setPipelineColumnCounts(map)
                } else {
                    if (process.env.NODE_ENV !== "production") {
                        console.warn(
                            "[Analytics] get_client_column_counts indisponible :",
                            error
                        )
                    }
                    setPipelineColumnCounts(null)
                }
            })
            .catch(() => {
                if (!cancelled) setPipelineColumnCounts(null)
            })

        // Cleanup function (nettoyage si le composant est démonté ou si les dépendances changent)
        return () => {
            cancelled = true
        }
    }, [
        userId,
        rangeStart,
        rangeEnd,
        prevRangeStart,
        prevRangeEnd,
        selectedCommercial,
        fetchEventstats,
        fetchDevisByUser,
        fetch_calendar_event,
        fetch_activite,
    ])

    // 4. --- RETOURNER TOUTES LES DONNÉES ---
    return useMemo(
        () => ({
            eventsStats,
            rpcClientStats,
            pipelineColumnCounts,
            fetchEventstats,
        }),
        [eventsStats, rpcClientStats, pipelineColumnCounts, fetchEventstats]
    )
}