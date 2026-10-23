import { supabase } from "@/integrations/supabase/client"
import { uniqueChannelTopic } from "@/shared/services/realtimeService"
import type { CryptedGroup } from "../hooks/useGroups"

/**
 * Accès aux tables `cryptedmessage_groups` et `cryptedmessage_group_members`
 * (+ channels realtime associés). Déplacé depuis hooks/useGroups.ts et
 * hooks/useCryptedGroupChat.ts (déplacement mécanique) — seule la couche
 * service est autorisée à importer le client Supabase (règle ESLint
 * no-restricted-imports). Les casts `as any` existants sont conservés tels
 * quels (typage strict Supabase incomplet sur ces tables).
 */

export type GroupMemberWithProfileRow = {
    user_id: string
    role: string
    joined_at: string
    profiles: {
        full_name?: string | null
        email?: string | null
        avatar_url?: string | null
    } | null
}

export type GroupMembershipRow = {
    last_read_at: string | null
    cryptedmessage_groups: CryptedGroup | null
}

export async function fetchGroupMembersWithProfiles(
    groupId: string
): Promise<{ data: GroupMemberWithProfileRow[] | null; error: unknown }> {
    const { data, error } = await // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
        .from("cryptedmessage_group_members")
        .select(
            `user_id, role, joined_at, profiles (full_name, email, avatar_url)`
        )
        .eq("group_id", groupId)
    return { data, error }
}

export async function fetchGroupMemberships(
    userId: string
): Promise<{ data: GroupMembershipRow[] | null; error: unknown }> {
    const { data, error } =
        await // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
            .from("cryptedmessage_group_members")
            .select(
                `last_read_at, cryptedmessage_groups (id, name, description, avatar_url, created_by, created_at, updated_at)`
            )
            .eq("user_id", userId)
    return { data, error }
}

export async function insertGroup(row: {
    name: string
    description: string | null
    created_by: string
}): Promise<{ data: CryptedGroup | null; error: unknown }> {
    const { data, error } =
        await // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
            .from("cryptedmessage_groups")
            .insert([row])
            .select("*")
            .single()
    return { data, error }
}

export async function insertGroupMembers(
    rows: Array<{ group_id: string; user_id: string; role: string }>
): Promise<{ error: unknown }> {
    const { error } = await // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from("cryptedmessage_group_members").insert(rows)
    return { error }
}

export async function deleteGroupMember(
    groupId: string,
    userId: string
): Promise<{ data: unknown[] | null; error: unknown }> {
    // Append .select() so Supabase returns the deleted rows.
    // Without it, RLS-blocked DELETEs return { error: null, data: [] }
    // which looks like success — we need to distinguish the two cases.
    const { data, error } =
        await // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
            .from("cryptedmessage_group_members")
            .delete()
            .eq("group_id", groupId)
            .eq("user_id", userId)
            .select()
    return { data, error }
}

export async function deleteGroupMemberRow(
    groupId: string,
    userId: string
): Promise<{ error: unknown }> {
    const { error } =
        await // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
            .from("cryptedmessage_group_members")
            .delete()
            .eq("group_id", groupId)
            .eq("user_id", userId)
    return { error }
}

export async function updateGroupMemberLastRead(
    groupId: string,
    userId: string,
    lastReadAt: string
): Promise<void> {
    await // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
        .from("cryptedmessage_group_members")
        .update({ last_read_at: lastReadAt })
        .eq("group_id", groupId)
        .eq("user_id", userId)
}

export async function updateGroupRow(
    groupId: string,
    updates: { name?: string }
): Promise<{ error: unknown }> {
    const { error } =
        await // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
            .from("cryptedmessage_groups")
            .update(updates)
            .eq("id", groupId)
    return { error }
}

export async function deleteGroupRow(
    groupId: string
): Promise<{ error: unknown }> {
    const { error } =
        await // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
            .from("cryptedmessage_groups")
            .delete()
            .eq("id", groupId)
    return { error }
}

/**
 * Abonnement realtime aux changements de membres d'un groupe.
 * Retourne la fonction de désabonnement (removeChannel).
 */
export function subscribeToGroupMembers(
    groupId: string,
    onChange: () => void
): () => void {
    const channel = supabase
        .channel(
            uniqueChannelTopic(`cryptedmessage-group-members-${groupId}`)
        )
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "cryptedmessage_group_members",
                filter: `group_id=eq.${groupId}`,
            },
            () => {
                onChange()
            }
        )
        .subscribe()

    return () => {
        supabase.removeChannel(channel)
    }
}

/**
 * Abonnement realtime aux adhésions de groupe de l'utilisateur courant.
 * Retourne la fonction de désabonnement (removeChannel).
 */
export function subscribeToMyGroupMemberships(
    userId: string,
    onChange: () => void
): () => void {
    const channel = supabase
        .channel(uniqueChannelTopic(`cryptedmessage-my-groups-${userId}`))
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "cryptedmessage_group_members",
                filter: `user_id=eq.${userId}`,
            },
            () => {
                onChange()
            }
        )
        .subscribe()

    return () => {
        supabase.removeChannel(channel)
    }
}
