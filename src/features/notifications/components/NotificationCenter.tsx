import { Button } from "@/shared/ui/atoms/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/atoms/popover"
import { Separator } from "@/shared/ui/atoms/separator"
import { useNotifications } from "@/features/notifications/hooks/Notification_hook/useNotifications"
import { Bell, CheckCheck, MessageSquare, Ticket, X } from "lucide-react"
import { useState } from "react"

// Ajout de CheckCheck dans les imports
import type { Notification as NotificationRecord } from "@/features/notifications/hooks/Notification_hook/useNotifications"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
const notificationIcons = {
    ticket: Ticket,
    message: MessageSquare,
    system: Bell,
}

const notificationColors = {
    ticket: "text-blue-500",
    message: "text-green-500",
    system: "text-purple-500",
}

const formatNotificationTimestamp = (timestamp?: string) => {
    if (!timestamp) return ""
    const date = new Date(timestamp)
    if (Number.isNaN(date.getTime())) return ""
    return date.toLocaleDateString("fr-FR", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    })
}

const extractNotificationDetails = (notification: NotificationRecord) => {
    const data = (notification?.data ?? {}) as Record<string, unknown>
    const candidateKeys = ["senderName", "sender_name", "from", "author"]

    let senderName: string | undefined
    for (const key of candidateKeys) {
        const value = data[key]
        if (typeof value === "string" && value.trim()) {
            senderName = value.trim()
            break
        }
    }

    let preview =
        typeof notification.message === "string"
            ? notification.message.trim()
            : ""

    if (!senderName && preview.includes(":")) {
        const [maybeSender, ...rest] = preview.split(":")
        const candidate = maybeSender.trim()
        if (candidate && rest.length > 0) {
            senderName = candidate
            preview = rest.join(":").trim()
        }
    }

    return { senderName, preview }
}

export function NotificationCenter() {
    const {
        notifications,
        loading,
        removeNotification,
        handleNotificationClick,
        markAllAsRead,
    } = useNotifications()

    const [isOpen, setIsOpen] = useState(false)

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="relative">
                    <Bell className="w-5 h-5" />
                    {notifications.length > 0 && (
                        <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500" />
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="w-80 p-0 bg-background border shadow-lg z-50"
                align="end"
            >
                <div className="flex items-center justify-between p-4 border-b">
                    <h3 className="font-semibold">Notifications</h3>

                    {/* Le bouton s'affiche uniquement s'il y a des notifications */}
                    {!loading && notifications.length > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto px-2 py-1 text-xs text-muted-foreground hover:text-foreground focus-visible:ring-0 dark:text-muted-foreground dark:hover:text-foreground"
                            onClick={() => {
                                if (markAllAsRead) markAllAsRead()
                            }}
                        >
                            <CheckCheck className="w-3 h-3 mr-1" />
                            Tout marquer comme lu
                        </Button>
                    )}
                </div>

                <div className="max-h-96 overflow-y-auto">
                    {!loading && notifications.length > 0 ? (
                        <div className="space-y-1">
                            {notifications.map((notification, index) => {
                                const { senderName } =
                                    extractNotificationDetails(notification)
                                const rawTitle =
                                    typeof notification.title === "string"
                                        ? notification.title.trim()
                                        : ""
                                const normalizedSender = senderName?.trim()
                                const hasTitle = rawTitle.length > 0
                                const showSecondary =
                                    normalizedSender &&
                                    hasTitle &&
                                    normalizedSender.localeCompare(
                                        rawTitle,
                                        undefined,
                                        {
                                            sensitivity: "accent",
                                        }
                                    ) !== 0
                                const primaryText =
                                    normalizedSender ||
                                    rawTitle ||
                                    "Notification"
                                const secondaryText = showSecondary
                                    ? rawTitle
                                    : undefined

                                const IconComponent =
                                    notification.type &&
                                    notificationIcons[notification.type]
                                        ? notificationIcons[notification.type]
                                        : Bell
                                const iconColor =
                                    notification.type &&
                                    notificationColors[notification.type]
                                        ? notificationColors[notification.type]
                                        : notificationColors.message

                                return (
                                    <div key={notification.id}>
                                        <div
                                            className="p-3 hover:bg-muted/50 cursor-pointer transition-colors"
                                            onClick={() => {
                                                handleNotificationClick(
                                                    notification
                                                )
                                                setIsOpen(false)
                                            }}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className="mt-0.5 h-8 w-8 flex items-center justify-center rounded-full bg-muted">
                                                    <IconComponent
                                                        className={`h-4 w-4 ${iconColor}`}
                                                    />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-semibold truncate">
                                                                {primaryText}
                                                            </p>
                                                            <span className="font-normal text-xs text-muted-foreground">
                                                                {formatNotificationTimestamp(
                                                                    notification.timestamp
                                                                )}
                                                            </span>
                                                            {secondaryText && (
                                                                <p className="text-xs text-muted-foreground truncate">
                                                                    {
                                                                        secondaryText
                                                                    }
                                                                </p>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="w-4 h-4 p-0 text-muted-foreground hover:text-destructive focus-visible:ring-0"
                                                                onClick={(
                                                                    event
                                                                ) => {
                                                                    event.stopPropagation()
                                                                    if (
                                                                        notification.id
                                                                    ) {
                                                                        removeNotification(
                                                                            notification.id
                                                                        )
                                                                    }
                                                                }}
                                                            >
                                                                <X className="w-3 h-3" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        {index < notifications.length - 1 && (
                                            <Separator />
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <EmptyState
                            size="sm"
                            icon={Bell}
                            title={loading ? "Chargement…" : "Aucune notification"}
                        />
                    )}
                </div>
            </PopoverContent>
        </Popover>
    )
}
