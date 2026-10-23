import { useCallback } from "react"
import { toast } from "sonner"
import { getAccessToken } from "../../services/calendarSessionService"
import {
    ameliaBridgeService,
    type AmeliaSyncAction,
    type AmeliaCustomer,
} from "../services/AmeliaBridgeService"

/**
 * Hook qui synchronise un événement CRM vers Amelia (via le bridge Go morgane).
 * Comportement type "fire-and-forget" : ne bloque jamais l'action principale,
 * les erreurs ne sont pas propagées — mais elles sont signalées à l'utilisateur.
 * Sans ce toast, un refus d'Amelia (créneau devenu indisponible, provider
 * masqué) laissait un RDV présent dans le CRM et absent de l'agenda public,
 * sans que personne ne le sache. Rattrapage groupé : POST /crm/sync-all-to-wp.
 *
 * Utilisation typique dans use_calendar.tsx, après une écriture Supabase :
 *   const { syncToAmelia } = useAmeliaSync()
 *   await supabase.from('Event_calendar').insert(...)
 *   syncToAmelia('create', { id, name, startDateTime, endDateTime })
 */
export function useAmeliaSync() {
    const syncToAmelia = useCallback(
        async (
            action: AmeliaSyncAction,
            payload: {
                id: string
                name: string | null | undefined
                startDateTime: string
                endDateTime: string
                owner?: string | null
                providerId?: number
                serviceId?: number
                customer?: AmeliaCustomer
            }
        ) => {
            try {
                const jwt = await getAccessToken()
                if (!jwt) {
                    console.warn("[useAmeliaSync] pas de session Supabase active")
                    return
                }
                await ameliaBridgeService.syncEvent(
                    action,
                    {
                        id: payload.id,
                        name: payload.name ?? "Créneau",
                        startDateTime: payload.startDateTime,
                        endDateTime: payload.endDateTime,
                        owner: payload.owner ?? undefined,
                        providerId: payload.providerId,
                        serviceId: payload.serviceId,
                        customer: payload.customer,
                    },
                    jwt
                )
            } catch (err) {
                console.error(`[useAmeliaSync] sync ${action} failed:`, err)
                toast.warning(
                    action === "delete"
                        ? "RDV supprimé du CRM, mais toujours présent sur Amelia"
                        : "RDV enregistré dans le CRM, mais non synchronisé avec Amelia",
                    { description: "Le créneau n'est pas à jour côté réservation en ligne." }
                )
            }
        },
        []
    )

    return { syncToAmelia }
}
