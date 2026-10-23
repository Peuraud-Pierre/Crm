import { useMemo } from "react"
import type { GroupMember } from "./useGroups"
import type { CryptedUser } from "./useCryptedUsers"
import type { SenderDirectory } from "../components/MessageList"

type AuthUser = {
    full_name?: string | null
    email?: string | null
    avatar_url?: string | null
} | null

/**
 * Annuaire `user_id -> identité` consommé par les bulles et l'indicateur de
 * frappe.
 *
 * Construit une seule fois par conversation : le résoudre message par message
 * rendrait le rendu de la liste quadratique. Extrait de `ChatView`, qui
 * dépassait le seuil de 400 lignes de CLAUDE.md.
 */
export function useSenderDirectory({
    groupMembers,
    profilesByService,
    currentUserId,
    user,
}: {
    groupMembers: GroupMember[]
    /** Profils de l'annuaire général, groupés par service. */
    profilesByService: Record<string, CryptedUser[]>
    currentUserId: string | null
    user: AuthUser
}): SenderDirectory {
return useMemo<SenderDirectory>(() => {
    const directory: SenderDirectory = new Map()

    const put = (
        userId: string | null | undefined,
        name: string | null | undefined,
        avatarUrl: string | null | undefined
    ) => {
        if (!userId || directory.has(userId)) return
        directory.set(userId, {
            name: name?.trim() || "Utilisateur inconnu",
            avatarUrl: avatarUrl ?? null,
        })
    }

    // Les membres actuels d'abord : c'est la source la plus à jour.
    for (const member of groupMembers) {
        put(member.user_id, member.full_name ?? member.email, member.avatar_url)
    }
    // Puis l'annuaire général, qui couvre les anciens membres dont les
    // messages restent affichés après leur départ du groupe, et nomme
    // l'interlocuteur d'une conversation 1-à-1.
    for (const list of Object.values(profilesByService)) {
        for (const profile of list) {
            put(
                profile.user_id,
                profile.full_name ?? profile.email,
                profile.avatar_url
            )
        }
    }
    put(currentUserId, user?.full_name ?? user?.email, user?.avatar_url)

    return directory
}, [groupMembers, profilesByService, currentUserId, user])
}
