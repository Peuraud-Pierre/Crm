import { useMemo } from "react"
import type { ActiveConversation } from "../components/ChatUsersSidebar"
import type { CryptedUser } from "./useCryptedUsers"

/**
 * Conversations 1-à-1 à remonter en haut de la liste.
 *
 * Extrait de `ChatView`, qui dépassait le seuil de 400 lignes de CLAUDE.md.
 * Logique pure, sans accès réseau : elle recroise trois sources déjà chargées.
 */
export function useActiveConversations({
    profilesByService,
    unreadByUser,
    recentByUser,
}: {
    profilesByService: Record<string, CryptedUser[]>
    unreadByUser: Record<string, number>
    recentByUser: Record<string, string>
}): ActiveConversation[] {
// Tous les
// interlocuteurs avec des non-lus OU un échange récent. Tri : non-lus d'abord,
// puis par date du dernier message (plus récent en premier).
return useMemo<ActiveConversation[]>(() => {
    const usersById: Record<string, CryptedUser> = {}
    for (const list of Object.values(profilesByService))
        for (const u of list) usersById[u.user_id] = u

    const ids = new Set<string>()
    for (const [id, n] of Object.entries(unreadByUser))
        if (n > 0) ids.add(id)
    for (const id of Object.keys(recentByUser)) ids.add(id)

    const list: ActiveConversation[] = []
    for (const id of ids) {
        const u = usersById[id]
        if (!u) continue
        list.push({
            user: u,
            unreadCount: unreadByUser[id] ?? 0,
            lastMessageAt: recentByUser[id] ?? null,
        })
    }

    list.sort((a, b) => {
        const au = a.unreadCount > 0 ? 1 : 0
        const bu = b.unreadCount > 0 ? 1 : 0
        if (au !== bu) return bu - au
        const at = a.lastMessageAt ? Date.parse(a.lastMessageAt) : 0
        const bt = b.lastMessageAt ? Date.parse(b.lastMessageAt) : 0
        if (at !== bt) return bt - at
        const an = a.user.full_name ?? a.user.email ?? a.user.user_id
        const bn = b.user.full_name ?? b.user.email ?? b.user.user_id
        return an.localeCompare(bn)
    })
    return list
}, [profilesByService, unreadByUser, recentByUser])
}
