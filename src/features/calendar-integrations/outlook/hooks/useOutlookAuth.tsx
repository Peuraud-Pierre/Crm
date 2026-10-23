import { useCallback, useEffect, useState } from "react"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { toast } from "sonner"
import { getAccessToken } from "../../services/calendarSessionService"
import { env } from "@/shared/lib/env"

export type OutlookConnection = {
    id: string
    email: string
    is_active: boolean
    last_sync_at: string | null
}

export function useOutlookAuth() {
    const { user } = useAuth()

    const [connection, setConnection] = useState<OutlookConnection | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isConnecting, setIsConnecting] = useState(false)

    const loadConnection = useCallback(async () => {
        if (!user) return

        setIsLoading(true)
        try {
            const accessToken = await getAccessToken()

            const res = await fetch(`${env.PUBLIC_API_BASE_URL}/api/outlook/status`, {
                credentials: "include",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            })
            const data = await res.json()
            setConnection(data[0] ?? null)
        } catch (e) {
            console.error(e)
        } finally {
            setIsLoading(false)
        }
    }, [user])

    useEffect(() => {
        loadConnection()
    }, [loadConnection])

    const connectToOutlook = async (email: string, password: string) => {
        setIsConnecting(true)
        try {
            const accessToken = await getAccessToken()
            const res = await fetch(`${env.PUBLIC_API_BASE_URL}/api/outlook/connect`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`,
                },
                credentials: "include",
                body: JSON.stringify({ email, password }),
            })

            if (!res.ok) throw new Error()

            toast.success("Outlook connecté avec succès")
            await loadConnection()
        } catch {
            toast.error("Connexion Outlook échouée")
        } finally {
            setIsConnecting(false)
        }
    }

    const disconnectOutlook = async () => {
        if (!connection) return

        const accessToken = await getAccessToken()

        await fetch(`${env.PUBLIC_API_BASE_URL}/api/outlook/disconnect/${connection.id}`, {
            method: "DELETE",
            credentials: "include",
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        })

        toast.success("Outlook déconnecté")
        setConnection(null)
    }

    return {
        connection,
        isConnected: !!connection,
        isConnecting,
        isLoading,
        connectToOutlook,
        disconnectOutlook,
        reloadConnection: loadConnection,
    }
}
