import { useAuth } from "@/features/auth/hooks/useAuth"
import { useEffect, useState } from "react"
import {
    listProfilesExcept,
    countUnreadByRecipient,
    subscribeToProfileChanges,
    subscribeToUnreadMessages,
} from "../services/profilesService"

export type CryptedUser = {
    user_id: string
    full_name: string | null
    email: string | null
    avatar_url: string | null
    status?: string | null
    service_name?: string | null
}

export function useCryptedUsers() {
    const { user } = useAuth()
    const [grouped, setGrouped] = useState<Record<string, CryptedUser[]>>({})
    const [loading, setLoading] = useState(false)
    const [unreadByUser, setUnreadByUser] = useState<Record<string, number>>(
        {}
    )

    const currentUserId = user?.user_id ?? user?.id ?? null

    useEffect(() => {
        let active = true
        const load = async () => {
            setLoading(true)
            const filtered = await listProfilesExcept(currentUserId)

            const nextGrouped: Record<string, CryptedUser[]> = {}
            for (const profile of filtered) {
                const key = profile.service_name ?? "Aucun service"
                if (!nextGrouped[key]) nextGrouped[key] = []
                nextGrouped[key].push(profile)
            }

            for (const key of Object.keys(nextGrouped)) {
                nextGrouped[key].sort((a, b) =>
                    (a.full_name ?? a.email ?? a.user_id).localeCompare(
                        b.full_name ?? b.email ?? b.user_id
                    )
                )
            }

            if (active) {
                setGrouped(nextGrouped)
                setLoading(false)
            }
        }

        load()

        const unsubscribe = subscribeToProfileChanges(() => load())

        return () => {
            active = false
            unsubscribe()
        }
    }, [currentUserId])

    useEffect(() => {
        if (!currentUserId) return
        let active = true

        const loadUnread = async () => {
            const counts = await countUnreadByRecipient(currentUserId)
            if (active) setUnreadByUser(counts)
        }

        loadUnread()

        const unsubscribe = subscribeToUnreadMessages(currentUserId, () =>
            loadUnread()
        )

        return () => {
            active = false
            unsubscribe()
        }
    }, [currentUserId])

    return { groups: grouped, loading, unreadByUser }
}
