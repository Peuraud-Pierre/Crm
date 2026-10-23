import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { updateClientNewsletter } from "@/features/crm/services/clientService"
import type { Client } from "@/features/crm/types/client"

/**
 * Opt-in newsletter d'un client, avec mise à jour optimiste + rollback.
 *
 * `ready` vaut false tant que la fiche n'affiche que la ligne légère de la
 * liste (sans `newsletter`) : la valeur réelle est inconnue, le switch doit
 * rester désactivé — sinon un clic pourrait être écrasé par la ligne
 * complète qui arrive ensuite.
 */
export function useClientNewsletterOptIn(client: Client | null | undefined) {
    const [checked, setChecked] = useState(!!client?.newsletter)
    const [updatedAt, setUpdatedAt] = useState<string | null>(
        client?.newsletter_updated_at ?? null
    )
    const [saving, setSaving] = useState(false)
    const ready = client?.newsletter !== undefined

    // Resynchronise quand la fiche affichée change ou est rechargée.
    // Ajustement pendant le rendu plutôt qu'un useEffect : pas de rendu
    // intermédiaire avec l'ancienne valeur.
    const syncKey = `${client?.id}|${client?.newsletter}|${client?.newsletter_updated_at}`
    const [prevSyncKey, setPrevSyncKey] = useState(syncKey)
    const [prevClientId, setPrevClientId] = useState(client?.id)
    if (prevSyncKey !== syncKey) {
        setPrevSyncKey(syncKey)
        setChecked(!!client?.newsletter)
        setUpdatedAt(client?.newsletter_updated_at ?? null)
    }
    if (prevClientId !== client?.id) {
        setPrevClientId(client?.id)
        setSaving(false)
    }

    // Client actuellement affiché : une réponse arrivée après navigation
    // vers un autre client (flèches précédent/suivant) ne doit pas toucher
    // son affichage. L'écriture en base, elle, vise bien l'id capturé.
    const currentIdRef = useRef(client?.id)
    useEffect(() => {
        currentIdRef.current = client?.id
    }, [client?.id])

    const toggle = async (value: boolean) => {
        const id = client?.id
        if (!id || !ready) return
        const previous = checked
        setChecked(value)
        setSaving(true)
        try {
            const at = await updateClientNewsletter(id, value)
            if (currentIdRef.current !== id) return
            setUpdatedAt(at)
            toast.success(
                value
                    ? "Client abonné à la newsletter."
                    : "Client désabonné de la newsletter."
            )
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : "Erreur inattendue."
            if (currentIdRef.current !== id) {
                toast.error(`Abonnement newsletter du client précédent : ${message}`)
                return
            }
            setChecked(previous)
            toast.error(message)
        } finally {
            if (currentIdRef.current === id) setSaving(false)
        }
    }

    return { checked, updatedAt, saving, ready, toggle }
}
