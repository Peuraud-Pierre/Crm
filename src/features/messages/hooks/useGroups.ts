import { useAuth } from "@/features/auth/hooks/useAuth"
import { useCallback, useEffect, useState } from "react"
import {
    deleteGroupMember,
    deleteGroupMemberRow,
    deleteGroupRow,
    fetchGroupMembersWithProfiles,
    fetchGroupMemberships,
    insertGroup,
    insertGroupMembers,
    subscribeToMyGroupMemberships,
    updateGroupMemberLastRead,
    updateGroupRow,
} from "../services/groupsService"

export type CryptedGroup = {
    id: string
    name: string
    description: string | null
    avatar_url: string | null
    created_by: string
    created_at: string
    updated_at: string
}

export type GroupMember = {
    user_id: string
    full_name: string | null
    email: string | null
    avatar_url: string | null
    role: string
    joined_at: string
}

export type GroupWithMeta = CryptedGroup & {
    last_read_at: string | null
}

export function useGroups() {
    const { user } = useAuth()
    const [groups, setGroups] = useState<GroupWithMeta[]>([])
    const [loading, setLoading] = useState(false)

    const currentUserId = user?.user_id ?? user?.id ?? null

    const loadGroups = useCallback(async () => {
        if (!currentUserId) return
        setLoading(true)

        const { data, error } = await fetchGroupMemberships(currentUserId)

        if (!error && data) {
            const list = data
                .map((row) => {
                    if (!row.cryptedmessage_groups) return null
                    return {
                        ...row.cryptedmessage_groups,
                        last_read_at: row.last_read_at,
                    }
                })
                .filter(Boolean) as GroupWithMeta[]
            setGroups(list)
        }

        setLoading(false)
    }, [currentUserId])

    const createGroup = useCallback(
        async ({
            name,
            description,
            memberIds,
        }: {
            name: string
            description?: string
            memberIds: string[]
        }): Promise<CryptedGroup | null> => {
            if (!currentUserId) return null

            const { data: group, error } = await insertGroup({
                name: name.trim(),
                description: description?.trim() || null,
                created_by: currentUserId,
            })

            if (error || !group) return null

            const allMemberIds = [...new Set([currentUserId, ...memberIds])]
            await insertGroupMembers(
                allMemberIds.map((id) => ({
                    group_id: group.id,
                    user_id: id,
                    role: id === currentUserId ? "admin" : "member",
                }))
            )

            await loadGroups()
            return group
        },
        [currentUserId, loadGroups]
    )

    const loadGroupMembers = useCallback(
        async (groupId: string): Promise<GroupMember[]> => {
            const { data, error } =
                await fetchGroupMembersWithProfiles(groupId)

            if (error || !data) return []

            return data.map((row) => ({
                user_id: row.user_id,
                full_name: row.profiles?.full_name ?? null,
                email: row.profiles?.email ?? null,
                avatar_url: row.profiles?.avatar_url ?? null,
                role: row.role,
                joined_at: row.joined_at,
            }))
        },
        []
    )

    const addMember = useCallback(
        async (groupId: string, userId: string): Promise<boolean> => {
            const { error } = await insertGroupMembers([
                { group_id: groupId, user_id: userId, role: "member" },
            ])
            return !error
        },
        []
    )

    const removeMember = useCallback(
        async (groupId: string, userId: string): Promise<boolean> => {
            // deleteGroupMember appends .select() so Supabase returns the
            // deleted rows — nécessaire pour distinguer un DELETE bloqué par
            // RLS ({ error: null, data: [] }) d'une vraie suppression.
            const { data, error } = await deleteGroupMember(groupId, userId)
            return !error && Array.isArray(data) && data.length > 0
        },
        []
    )

    const markGroupRead = useCallback(
        async (groupId: string) => {
            if (!currentUserId) return
            await updateGroupMemberLastRead(
                groupId,
                currentUserId,
                new Date().toISOString()
            )
        },
        [currentUserId]
    )

    const updateGroup = useCallback(
        async (
            groupId: string,
            updates: { name?: string }
        ): Promise<boolean> => {
            const { error } = await updateGroupRow(groupId, updates)
            if (!error) await loadGroups()
            return !error
        },
        [loadGroups]
    )

    const deleteGroup = useCallback(
        async (groupId: string): Promise<boolean> => {
            const { error } = await deleteGroupRow(groupId)
            if (!error) await loadGroups()
            return !error
        },
        [loadGroups]
    )

    const leaveGroup = useCallback(
        async (groupId: string): Promise<boolean> => {
            if (!currentUserId) return false
            const { error } = await deleteGroupMemberRow(
                groupId,
                currentUserId
            )
            if (!error) await loadGroups()
            return !error
        },
        [currentUserId, loadGroups]
    )

    useEffect(() => {
        void loadGroups()
    }, [loadGroups])

    useEffect(() => {
        if (!currentUserId) return

        const unsubscribe = subscribeToMyGroupMemberships(currentUserId, () => {
            void loadGroups()
        })

        return unsubscribe
    }, [currentUserId, loadGroups])

    return {
        groups,
        loading,
        createGroup,
        loadGroups,
        loadGroupMembers,
        addMember,
        removeMember,
        markGroupRead,
        updateGroup,
        deleteGroup,
        leaveGroup,
    }
}
