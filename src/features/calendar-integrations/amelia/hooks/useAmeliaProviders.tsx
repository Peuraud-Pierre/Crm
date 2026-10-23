import { useCallback, useEffect, useState } from "react"
import { getAccessToken } from "../../services/calendarSessionService"
import { env } from "@/shared/lib/env"

const BRIDGE_URL = env.PUBLIC_VITE_BRIDGE_URL || ""
const BRIDGE_KEY = env.PUBLIC_VITE_BRIDGE_KEY || ""

export interface AmeliaProvider {
    amelia_provider_id: number
    supabase_user_id?: string
    email: string
    first_name: string
    last_name: string
    status?: string
}

/**
 * Liste des commerciaux Amelia + leur mapping Supabase.
 * Consomme GET /api/providers exposé par le bridge Go.
 */
export function useAmeliaProviders() {
    const [providers, setProviders] = useState<AmeliaProvider[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchProviders = useCallback(async () => {
        if (!BRIDGE_URL || !BRIDGE_KEY) {
            setError("VITE_BRIDGE_URL / VITE_BRIDGE_KEY manquants")
            setLoading(false)
            return
        }
        try {
            setLoading(true)
            const jwt = await getAccessToken()
            if (!jwt) {
                setError("Session Supabase manquante")
                setLoading(false)
                return
            }
            const res = await fetch(`${BRIDGE_URL}/api/providers`, {
                headers: {
                    "X-Bridge-Key": BRIDGE_KEY,
                    Authorization: `Bearer ${jwt}`,
                },
            })
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${await res.text()}`)
            }
            const data: AmeliaProvider[] = await res.json()
            setProviders(data ?? [])
            setError(null)
        } catch (err) {
            console.error("[useAmeliaProviders]", err)
            setError(err instanceof Error ? err.message : "Erreur inconnue")
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchProviders()
    }, [fetchProviders])

    /** Force une resync côté bridge (POST /providers/sync) puis re-fetch. */
    const refresh = useCallback(async () => {
        if (!BRIDGE_URL || !BRIDGE_KEY) return
        const jwt = await getAccessToken()
        if (!jwt) return
        await fetch(`${BRIDGE_URL}/providers/sync`, {
            method: "POST",
            headers: {
                "X-Bridge-Key": BRIDGE_KEY,
                Authorization: `Bearer ${jwt}`,
            },
        }).catch((err) =>
            console.warn("[useAmeliaProviders] resync failed", err)
        )
        await fetchProviders()
    }, [fetchProviders])

    /** Recherche un provider par user_id Supabase. */
    const byOwner = useCallback(
        (ownerId?: string | null): AmeliaProvider | undefined => {
            if (!ownerId) return undefined
            return providers.find((p) => p.supabase_user_id === ownerId)
        },
        [providers]
    )

    return { providers, loading, error, refresh, byOwner }
}
