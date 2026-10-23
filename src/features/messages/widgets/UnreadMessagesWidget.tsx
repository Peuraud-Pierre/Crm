import { AlertTriangle, MailCheck, MessageSquare } from "lucide-react"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { useWidgetData } from "@/shared/hooks/useWidgetData"
import { isRouteAllowed } from "@/shared/lib/routeAccess"
import type { WidgetProps } from "@/shared/types/widget.types"
import { Badge } from "@/shared/ui/atoms/badge"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import { SkeletonList } from "@/shared/ui/molecules/skeleton-presets"
import { WidgetList, WidgetRow } from "@/shared/ui/molecules/widget-list"
import {
    countUnreadByRecipient,
    listProfilesExcept,
} from "../services/profilesService"

interface UnreadSender {
    userId: string
    name: string
    count: number
}

/**
 * Qui attend une réponse, et depuis combien de messages.
 *
 * Les compteurs viennent d'une requête, les noms d'une autre : le module
 * n'affiche que des expéditeurs identifiés, donc les deux sont jointes ici
 * plutôt que dans le rendu.
 */
async function fetchUnreadSenders(userId: string): Promise<UnreadSender[]> {
    const [counts, profiles] = await Promise.all([
        countUnreadByRecipient(userId),
        listProfilesExcept(userId),
    ])

    const byId = new Map(profiles.map((p) => [p.user_id, p]))

    return Object.entries(counts)
        .map(([senderId, count]) => ({
            userId: senderId,
            name:
                byId.get(senderId)?.full_name ??
                byId.get(senderId)?.email ??
                "Utilisateur inconnu",
            count,
        }))
        .sort((a, b) => b.count - a.count)
}

/**
 * Les messages non lus, par expéditeur.
 *
 * Le module ne montre **jamais** le contenu d'un message : les messages
 * sont chiffrés de bout en bout, et leur déchiffrement suppose la clé de
 * l'appareil et le passage par la messagerie. Ce qui est affichable ici,
 * c'est qui attend une réponse et depuis combien de messages.
 */
export default function UnreadMessagesWidget({
    height,
    compact,
}: WidgetProps) {
    const { user, allowedRoutes } = useAuth()
    const userId = user?.user_id

    const limit = Math.max(3, Math.floor(height * 1.2))

    const { data, loading, error } = useWidgetData(
        userId ? () => fetchUnreadSenders(userId) : null,
        [userId],
        "UnreadMessagesWidget"
    )
    const senders: UnreadSender[] = data ?? []

    if (loading) {
        return (
            <div className="p-3">
                <SkeletonList rows={3} label="Chargement de vos messages" />
            </div>
        )
    }

    if (error) {
        return (
            <EmptyState
                size="sm"
                variant="error"
                icon={AlertTriangle}
                title="Chargement impossible"
                description="Vos messages non lus n'ont pas pu être récupérés."
            />
        )
    }

    if (senders.length === 0) {
        return (
            <EmptyState
                size="sm"
                icon={MailCheck}
                title="Aucun message non lu"
                description="Vous êtes à jour."
            />
        )
    }

    const target = isRouteAllowed("/messages", allowedRoutes)
        ? "/messages"
        : undefined

    return (
        <WidgetList>
            {senders.slice(0, limit).map((sender) => (
                <WidgetRow
                    key={sender.userId}
                    to={target}
                    icon={MessageSquare}
                    accent="chart-2"
                    compact={compact}
                    title={sender.name}
                    trailing={
                        <Badge className="shrink-0">{sender.count}</Badge>
                    }
                />
            ))}
        </WidgetList>
    )
}
