/**
 * Hook for Apple iCloud Calendar authentication
 */

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { getAccessToken } from "../../services/calendarSessionService"
import { appleCalendarService } from "../services/AppleCalendarService"
import type {
    AppleConnection,
    AppleSyncEventAction,
} from "../types/apple-auth.types"
import { toast } from "sonner"

export const useAppleAuth = () => {
    const { user } = useAuth()
    const [connection, setConnection] = useState<AppleConnection | null>(null)
    const [isConnected, setIsConnected] = useState(false)
    const [isConnecting, setIsConnecting] = useState(false)
    const [isLoading, setIsLoading] = useState(true)

    /**
     * Load connection status
     */
    const loadConnection = useCallback(async () => {
        if (!user) {
            setIsLoading(false)
            return
        }

        try {
            setIsLoading(true)
            const accessToken = await getAccessToken()

            if (!accessToken) {
                setIsLoading(false)
                return
            }

            const connections = await appleCalendarService.status(accessToken)

            // Find the first active connection
            const activeConnection = connections.find((conn) => conn.is_active)

            if (activeConnection) {
                setConnection(activeConnection)
                setIsConnected(true)
            } else {
                setConnection(null)
                setIsConnected(false)
            }
        } catch (error) {
            console.error("Failed to load Apple calendar connection:", error)
            // Don't show error toast on initial load to avoid spamming user
            // The backend might not be available yet
            setConnection(null)
            setIsConnected(false)
        } finally {
            setIsLoading(false)
        }
    }, [user])

    /**
     * Connect to Apple iCloud
     */
    const connectToApple = useCallback(
        async (email: string, appPassword: string) => {
            if (!user) {
                toast.error("Vous devez être authentifié")
                return
            }

            try {
                setIsConnecting(true)
                const accessToken = await getAccessToken()

                if (!accessToken) {
                    toast.error("Session expirée, veuillez vous reconnecter")
                    return
                }

                const response = await appleCalendarService.connect(
                    email,
                    appPassword,
                    accessToken
                )

                toast.success(`Connecté à Apple Calendar: ${response.email}`)

                // Reload connection status
                await loadConnection()
            } catch (error) {
                console.error("Failed to connect to Apple calendar:", error)
                toast.error(
                    (error instanceof Error ? error.message : undefined) ||
                        "Erreur lors de la connexion à Apple Calendar"
                )
                throw error
            } finally {
                setIsConnecting(false)
            }
        },
        [user, loadConnection]
    )

    /**
     * Disconnect from Apple iCloud
     */
    const disconnectApple = useCallback(async () => {
        if (!user || !connection?.id) {
            toast.error("Aucune connexion active")
            return
        }

        try {
            setIsConnecting(true)
            const accessToken = await getAccessToken()

            if (!accessToken) {
                toast.error("Session expirée, veuillez vous reconnecter")
                return
            }

            await appleCalendarService.disconnect(connection.id, accessToken)

            toast.success("Déconnecté d'Apple Calendar")

            // Reload connection status
            await loadConnection()
        } catch (error) {
            console.error("Failed to disconnect Apple calendar:", error)
            toast.error((error instanceof Error ? error.message : undefined) || "Erreur lors de la déconnexion")
            throw error
        } finally {
            setIsConnecting(false)
        }
    }, [user, connection?.id, loadConnection])

    /**
     * Permanently delete Apple connection
     */
    const deleteAppleConnection = useCallback(async () => {
        if (!user || !connection?.id) {
            toast.error("Aucune connexion active")
            return
        }

        try {
            setIsConnecting(true)
            const accessToken = await getAccessToken()

            if (!accessToken) {
                toast.error("Session expirée, veuillez vous reconnecter")
                return
            }

            await appleCalendarService.delete(connection.id, accessToken)

            toast.success("Connexion Apple Calendar supprimée définitivement")

            // Reload connection status
            await loadConnection()
        } catch (error) {
            console.error("Failed to delete Apple calendar connection:", error)
            toast.error((error instanceof Error ? error.message : undefined) || "Erreur lors de la suppression")
            throw error
        } finally {
            setIsConnecting(false)
        }
    }, [user, connection?.id, loadConnection])

    /**
     * Trigger immediate sync
     */
    const syncNow = useCallback(async () => {
        if (!user) {
            toast.error("Vous devez être authentifié")
            return
        }

        try {
            const accessToken = await getAccessToken()

            if (!accessToken) {
                toast.error("Session expirée, veuillez vous reconnecter")
                return
            }

            const response = await appleCalendarService.syncNow(accessToken)
            toast.success(response.message || "Synchronisation démarrée")
        } catch (error) {
            console.error("Failed to sync Apple calendar:", error)
            toast.error((error instanceof Error ? error.message : undefined) || "Erreur lors de la synchronisation")
            throw error
        }
    }, [user])

    /**
     * Sync a single event to Apple Calendar
     * Use after creating, updating, or deleting an event
     * @param eventId - The local event ID
     * @param action - 'create' | 'update' | 'delete'
     */
    const syncEvent = useCallback(
        async (
            eventId: string,
            action: AppleSyncEventAction,
            userId: string
        ) => {
            console.log(
                `🔄 Syncing event to Apple Calendar: ID=${eventId}, action=${action}, userId=${userId}`
            )
            // On n'exige PAS que le créateur soit connecté à Apple : le backend
            // route l'événement vers les connexions de la personne affectée
            // (Attribution_Id) et du compte central. Si personne n'est lié,
            // le backend ne fait rien — pas besoin de filtrer ici.
            if (!user?.user_id) {
                return
            }

            try {
                const accessToken = await getAccessToken()

                if (!accessToken) {
                    console.warn("No access token for Apple sync")
                    return
                }

                // 🔴 PASSAGE du 4ème paramètre : user.user_id
                await appleCalendarService.syncEvent(
                    eventId,
                    action,
                    accessToken,
                    user.user_id,
                    userId
                )
            } catch (error) {
                console.error(
                    `Failed to sync event (${action}) to Apple calendar:`,
                    error
                )
                // Don't throw - syncing should not block the main action
            }
        },
        [user]
    ) // user est dans les dépendances, donc user.user_id sera toujours à jour

    /**
     * Reload connection status
     */
    const reloadConnection = useCallback(async () => {
        await loadConnection()
    }, [loadConnection])

    // Load connection on mount and when user changes
    useEffect(() => {
        loadConnection()
    }, [loadConnection])

    return {
        connection,
        isConnected,
        isConnecting,
        isLoading,
        connectToApple,
        disconnectApple,
        deleteAppleConnection,
        syncNow,
        syncEvent,
        reloadConnection,
    }
}
