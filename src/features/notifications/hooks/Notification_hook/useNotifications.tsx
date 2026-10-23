import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import {
    deleteNotificationById,
    deleteNotificationsByIds,
    fetchNotificationsForUser,
    subscribeToNotifications,
    type NotificationRow,
} from "@/features/notifications/services/notificationService"
import { ensurePushSubscription, isPushSupported } from "@/shared/lib/pwa"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router"
import { toast } from "sonner"

import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js"

export interface Notification {
    id?: string
    type?: "ticket" | "message" | "system"
    title?: string
    timestamp?: string
    url?: string
    data?: Record<string, unknown> | null
    message?: string
}

const notificationTypeRoutes: Record<
    NonNullable<Notification["type"]>,
    string
> = {
    ticket: "/tickets",
    message: "/messages",
    system: "/dashboard",
}

const mapRowToNotification = (row: NotificationRow): Notification => {
    const record = row as Record<string, unknown>
    const rawUrl = record.url ?? record.Url
    const rawTimestamp = record.created_at ?? record.Created_At
    const rawData = record.data

    return {
        id: row.id ?? undefined,
        type: (row.type as Notification["type"]) ?? undefined,
        title: row.title ?? undefined,
        timestamp: typeof rawTimestamp === "string" ? rawTimestamp : undefined,
        url: typeof rawUrl === "string" ? rawUrl : undefined,
        data:
            rawData && typeof rawData === "object"
                ? (rawData as Record<string, unknown>)
                : null,
    }
}

export function useNotifications() {
    const { user } = useAuth()
    const navigate = useNavigate()
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [loading, setLoading] = useState(true)

    // // Remove notification
    const removeNotification = useCallback(async (id: string) => {
        setNotifications((prev) => prev.filter((n) => n.id !== id))

        // Suppression
        const { error } = await deleteNotificationById(id)
        if (error) console.error("Erreur lors de la suppression :", error)
    }, [])

    const markAllAsRead = useCallback(async () => {
        const ids = notifications
            .map((n) => n.id)
            .filter((id): id is string => !!id)

        setNotifications([])

        const { error } = await deleteNotificationsByIds(ids)
        if (error) console.error("Erreur lors de la suppression :", error)
    }, [notifications])

    // Handle notification click
    const handleNotificationClick = useCallback(
        (notification: Notification) => {
            if (!notification.id) return

            void removeNotification(notification.id)

            // Priorité à l'URL explicite de la notification, sinon
            // redirection selon le type.
            const target =
                notification.url?.trim() ||
                notificationTypeRoutes[notification.type ?? "system"] ||
                "/dashboard"

            navigate(target)
        },
        [navigate, removeNotification]
    )

    // Fetch notifications from DB
    const fetchNotifications = useCallback(async () => {
        if (!user) {
            setNotifications([])
            setLoading(false)
            return
        }

        setLoading(true)

        try {
            const userId = user.user_id ?? user.id

            const { data, error } = await fetchNotificationsForUser(userId)

            if (error) {
                console.error(
                    "Erreur lors de la récupération des notifications :",
                    error
                )
                toast.error("Erreur lors du chargement des notifications")
            } else {
                setNotifications(
                    (data ?? [])
                        .map((row) =>
                            mapRowToNotification(row as NotificationRow)
                        )
                        .sort((a, b) => {
                            const dateA = new Date(a.timestamp || "").getTime()
                            const dateB = new Date(b.timestamp || "").getTime()
                            return dateB - dateA
                        })
                )
            }
        } catch (err) {
            console.error("Erreur inattendue :", err)
            toast.error("Erreur interne lors du chargement des notifications")
        } finally {
            setLoading(false)
        }
    }, [user])

    useEffect(() => {
        if (!user || !isPushSupported()) {
            return
        }

        if (Notification.permission === "granted") {
            ensurePushSubscription(user.user_id).catch((error) => {
                console.error("Impossible de valider l'inscription push", error)
            })
        }
    }, [user])

    useEffect(() => {
        if (!user) return

        fetchNotifications()

        const handlePayload = (
            payload: RealtimePostgresChangesPayload<NotificationRow>
        ) => {
            if (payload.eventType === "INSERT" && payload.new) {
                setNotifications((prev) => [
                    mapRowToNotification(payload.new),
                    ...prev,
                ])
            } else if (payload.eventType === "UPDATE" && payload.new) {
                setNotifications((prev) =>
                    prev.map((n) =>
                        n.id === payload.new.id
                            ? mapRowToNotification(payload.new)
                            : n
                    )
                )
            } else if (payload.eventType === "DELETE") {
                setNotifications((prev) =>
                    prev.filter((n) => n.id !== payload.old?.id)
                )
            }
        }

        const unsubscribeUser = subscribeToNotifications(
            `notifications-user-${user.user_id}`,
            user.user_id,
            handlePayload
        )

        let unsubscribeService: (() => void) | null = null
        if (user.service_id) {
            unsubscribeService = subscribeToNotifications(
                `notifications-service-${user.service_id}`,
                user.service_id,
                handlePayload
            )
        }

        return () => {
            unsubscribeUser()
            if (unsubscribeService) unsubscribeService()
        }
    }, [fetchNotifications, user])

    // Format timestamp
    const formatTimeAgo = useCallback((timestamp: string) => {
        const now = new Date()
        const notifTime = new Date(timestamp)
        const diffInMinutes = Math.floor(
            (now.getTime() - notifTime.getTime()) / (1000 * 60)
        )

        if (diffInMinutes < 1) return "À l'instant"
        if (diffInMinutes < 60) return `Il y a ${diffInMinutes}m`
        if (diffInMinutes < 1440)
            return `Il y a ${Math.floor(diffInMinutes / 60)}h`
        return `Il y a ${Math.floor(diffInMinutes / 1440)}j`
    }, [])

    const values = useMemo(
        () => ({
            notifications,
            loading,
            removeNotification,
            handleNotificationClick,
            fetchNotifications,
            formatTimeAgo,
            markAllAsRead,
        }),
        [
            notifications,
            loading,
            removeNotification,
            handleNotificationClick,
            fetchNotifications,
            formatTimeAgo,
            markAllAsRead,
        ]
    )

    return values
}
