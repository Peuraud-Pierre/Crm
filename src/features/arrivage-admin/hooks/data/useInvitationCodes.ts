import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import {
    fetchInvitationCodes,
    insertInvitationCode,
} from "@/features/arrivage-admin/services/newsletterService"
import type { InvitationCode } from "@/features/arrivage-admin/types"

/**
 * Codes d'invitation newsletter. Extrait de `ArrivageAdmin.tsx`, qui appelait
 * la couche service directement depuis le composant.
 */
export function useInvitationCodes() {
    const [codes, setCodes] = useState<InvitationCode[]>([])
    const [loading, setLoading] = useState(true)
    const [creating, setCreating] = useState(false)

    // Une requête lente ne doit pas écraser le résultat d'une plus récente.
    const requestIdRef = useRef(0)

    const refetch = useCallback(async () => {
        const requestId = ++requestIdRef.current
        setLoading(true)
        try {
            const data = await fetchInvitationCodes()
            if (requestId !== requestIdRef.current) return
            setCodes(data)
        } catch (e: unknown) {
            if (requestId !== requestIdRef.current) return
            toast.error(e instanceof Error ? e.message : "Erreur inattendue.")
        } finally {
            if (requestId === requestIdRef.current) setLoading(false)
        }
    }, [])

    useEffect(() => {
        refetch()
    }, [refetch])

    /** Retourne `true` si le code a bien été créé, pour que l'appelant ferme sa modale. */
    const createCode = useCallback(
        async (code: string, label: string, createdBy: string) => {
            setCreating(true)
            try {
                await insertInvitationCode({
                    code,
                    label: label || null,
                    created_by: createdBy,
                })
                toast.success(`Code ${code} créé.`)
                await refetch()
                return true
            } catch (e: unknown) {
                toast.error(e instanceof Error ? e.message : "Erreur inattendue.")
                return false
            } finally {
                setCreating(false)
            }
        },
        [refetch]
    )

    return { codes, loading, creating, refetch, createCode }
}
