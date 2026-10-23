import { Bell } from "lucide-react"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/shared/ui/atoms/card"
import { Label } from "@/shared/ui/atoms/label"
import { Separator } from "@/shared/ui/atoms/separator"
import { Switch } from "@/shared/ui/atoms/switch"
import { usePushPreference } from "@/features/profile/hooks/data/usePushPreference"
import type { UserPreferences } from "@/features/profile/types"

type NotificationKey = "notify_ticket" | "notify_message" | "notify_system"

interface NotificationsCardProps {
    preferences: Omit<UserPreferences, "user_id">
    disabled: boolean
    onChange: (
        patch: Partial<Omit<UserPreferences, "user_id">>
    ) => Promise<boolean>
}

const IN_APP_TYPES: { key: NotificationKey; label: string; hint: string }[] = [
    {
        key: "notify_ticket",
        label: "Tickets",
        hint: "Attribution, réponse et changement de statut.",
    },
    {
        key: "notify_message",
        label: "Messages",
        hint: "Nouveaux messages et conversations.",
    },
    {
        key: "notify_system",
        label: "Système",
        hint: "Maintenance, rappels et alertes applicatives.",
    },
]

export function NotificationsCard({
    preferences,
    disabled,
    onChange,
}: NotificationsCardProps) {
    const { permission, subscribed, busy, enable, disable } =
        usePushPreference()

    const pushBlocked = permission === "denied" || permission === "unsupported"
    const pushOn = preferences.push_enabled && subscribed

    const handlePushToggle = async (next: boolean) => {
        // L'ordre compte : on ne persiste le consentement applicatif que si
        // l'opération côté navigateur a abouti.
        const ok = next ? await enable() : await disable()
        if (ok) await onChange({ push_enabled: next })
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    Notifications
                </CardTitle>
                <CardDescription>
                    Choisissez ce dont vous souhaitez être averti.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Notifications push
                    </p>
                    <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                            <Label htmlFor="push-toggle">
                                Activer sur cet appareil
                            </Label>
                            <p className="text-xs text-muted-foreground">
                                {permission === "unsupported"
                                    ? "Ce navigateur ne prend pas en charge les notifications push."
                                    : permission === "denied"
                                      ? "Les notifications sont bloquées dans les réglages du navigateur — réautorisez-les pour ce site."
                                      : "L'abonnement est propre à ce navigateur."}
                            </p>
                        </div>
                        <Switch
                            id="push-toggle"
                            checked={pushOn}
                            disabled={disabled || busy || pushBlocked}
                            onCheckedChange={handlePushToggle}
                        />
                    </div>
                </div>

                <Separator />

                <div className="space-y-4">
                    <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Notifications dans l'application
                    </p>
                    {IN_APP_TYPES.map(({ key, label, hint }) => (
                        <div
                            key={key}
                            className="flex items-start justify-between gap-4"
                        >
                            <div className="space-y-1">
                                <Label htmlFor={key}>{label}</Label>
                                <p className="text-xs text-muted-foreground">
                                    {hint}
                                </p>
                            </div>
                            <Switch
                                id={key}
                                checked={preferences[key]}
                                disabled={disabled}
                                onCheckedChange={(checked) =>
                                    onChange({ [key]: checked })
                                }
                            />
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}
