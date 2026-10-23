import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { fetchProfileWithRelations } from "../../services/profileService"

/**
 * Champs du profil absents du contexte d'auth (qui ne porte que ce dont
 * l'app a besoin en permanence) : téléphone et traçabilité du consentement.
 */
export interface ProfileDetails {
    phone: string | null
    created_at: string | null
    privacy_accepted_at: string | null
    privacy_accepted_version: string | null
}

const EMPTY: ProfileDetails = {
    phone: null,
    created_at: null,
    privacy_accepted_at: null,
    privacy_accepted_version: null,
}

export function useProfileDetails() {
    const { user } = useAuth()
    const userId = user?.user_id ?? user?.id ?? null

    const [details, setDetails] = useState<ProfileDetails>(EMPTY)
    const [loading, setLoading] = useState(true)
    // Dernière requête gagne : une réponse tardive est ignorée.
    const requestIdRef = useRef(0)

    const refetch = useCallback(async () => {
        if (!userId) return

        const requestId = ++requestIdRef.current
        try {
            const { data, error } = await fetchProfileWithRelations(userId)
            if (error) throw error
            if (requestIdRef.current !== requestId) return

            setDetails(
                data
                    ? {
                          phone: data.phone,
                          created_at: data.created_at,
                          privacy_accepted_at: data.privacy_accepted_at,
                          privacy_accepted_version:
                              data.privacy_accepted_version,
                      }
                    : EMPTY
            )
        } catch (err) {
            if (requestIdRef.current !== requestId) return
            console.error("[useProfileDetails] refetch:", err)
            toast.error("Erreur lors du chargement du profil")
        } finally {
            if (requestIdRef.current === requestId) setLoading(false)
        }
    }, [userId])

    useEffect(() => {
        refetch()
    }, [refetch])

    return { details, loading, refetch }
}
