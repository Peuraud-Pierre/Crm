import { supabase } from "@/integrations/supabase/client"
import { uniqueChannelTopic } from "@/shared/services/realtimeService"
import type { Database } from "@/integrations/supabase/types"

export type MessageRow = Database["public"]["Tables"]["cryptedmessage"]["Row"]
export type MessageInsert =
    Database["public"]["Tables"]["cryptedmessage"]["Insert"]
export type MessageUpdate =
    Database["public"]["Tables"]["cryptedmessage"]["Update"]

/**
 * Accès à la table `cryptedmessage`, au bucket Storage associé et aux channels
 * realtime des conversations. Déplacé depuis hooks/useCryptedChat.ts et
 * hooks/useCryptedGroupChat.ts (déplacement mécanique) — seule la couche
 * service est autorisée à importer le client Supabase (règle ESLint
 * no-restricted-imports). Les casts `as any` existants sont conservés tels
 * quels (typage strict Supabase incomplet sur ces tables).
 */

export async function fetchLatestMessages(
    chatId: string,
    limit: number
): Promise<{ data: MessageRow[]; error: unknown }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await (supabase.from("cryptedmessage") as any)
        .select("*")
        .eq("chat_id", chatId as string)
        .order("created_at", { ascending: false })
        .limit(limit)
    return response
}

export async function fetchMessagesBefore(
    chatId: string,
    before: string,
    limit: number
): Promise<{ data: MessageRow[]; error: unknown }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await (supabase.from("cryptedmessage") as any)
        .select("*")
        .eq("chat_id", chatId as string)
        .lt("created_at", before)
        .order("created_at", { ascending: false })
        .limit(limit)
    return response
}

/**
 * Derniers messages d'un groupe, du plus récent au plus ancien.
 *
 * La requête chargeait auparavant **tout** l'historique, sans limite ni
 * pagination : ouvrir un groupe ancien rapatriait et déchiffrait des milliers
 * de lignes. Miroir de `fetchLatestMessages` côté 1-à-1 — l'appelant remet la
 * page à l'endroit avec `reverse()`.
 */
export async function fetchGroupMessages(
    chatId: string,
    limit: number
): Promise<{ data: MessageRow[] | null; error: unknown }> {
    const { data, error } = await // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
        .from("cryptedmessage")
        .select("*")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: false })
        .limit(limit)
    return { data, error }
}

/** Page précédente d'un groupe. Miroir de `fetchMessagesBefore`. */
export async function fetchGroupMessagesBefore(
    chatId: string,
    before: string,
    limit: number
): Promise<{ data: MessageRow[] | null; error: unknown }> {
    const { data, error } = await // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
        .from("cryptedmessage")
        .select("*")
        .eq("chat_id", chatId)
        .lt("created_at", before)
        .order("created_at", { ascending: false })
        .limit(limit)
    return { data, error }
}

export async function insertCryptedMessage(
    payload: MessageInsert
): Promise<{ data: MessageRow | null; error: { message?: string } | null }> {
    const { data, error } =
        await // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("cryptedmessage") as any)
            .insert([payload])
            .select("*")
            .single()
    return { data, error }
}

export async function markThreadMessagesRead(
    recipientId: string,
    senderId: string
): Promise<{ error: unknown }> {
    const updatePayload: MessageUpdate = { read: true }
    const { error } =
        await // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("cryptedmessage") as any)
            .update(updatePayload)
            .eq("recipient_id", recipientId as string)
            .eq("sender_id", senderId as string)
            .eq("read", false)
    return { error }
}

export async function markMessageRead(messageId: number): Promise<void> {
    const updatePayload: MessageUpdate = { read: true }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("cryptedmessage") as any)
        .update(updatePayload)
        .eq("id", messageId as number)
}

export async function softDeleteMessage(
    messageId: number,
    senderId: string,
    deletedAt: string
): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("cryptedmessage") as any)
        .update({ deleted_at: deletedAt })
        .eq("id", messageId as number)
        .eq("sender_id", senderId as string)
}

export async function downloadAttachment(
    bucket: string,
    path: string
): Promise<{ data: Blob | null; error: unknown }> {
    const { data, error } = await supabase.storage.from(bucket).download(path)
    return { data, error }
}

export async function uploadEncryptedAttachment(
    bucket: string,
    path: string,
    blob: Blob
): Promise<{ error: { message?: string } | null }> {
    const { error } = await supabase.storage.from(bucket).upload(path, blob, {
        contentType: "application/octet-stream",
    })
    return { error }
}

export async function removeAttachment(
    bucket: string,
    path: string
): Promise<{ error: unknown }> {
    const { error } = await supabase.storage.from(bucket).remove([path])
    return { error }
}

/**
 * Abonnement realtime aux messages d'une conversation (INSERT, et UPDATE si
 * fourni). Retourne la fonction de désabonnement (removeChannel).
 */
export function subscribeToChatMessages(
    chatId: string,
    callbacks: {
        onInsert: (row: MessageRow) => void
        onUpdate?: (row: MessageRow) => void
    }
): () => void {
    const { onInsert, onUpdate } = callbacks
    let channel = supabase.channel(uniqueChannelTopic(`crypted-messages-${chatId}`)).on(
        "postgres_changes",
        {
            event: "INSERT",
            schema: "public",
            table: "cryptedmessage",
            filter: `chat_id=eq.${chatId}`,
        },
        (payload: { new: MessageRow }) => {
            onInsert(payload.new)
        }
    )
    if (onUpdate) {
        channel = channel.on(
            "postgres_changes",
            {
                event: "UPDATE",
                schema: "public",
                table: "cryptedmessage",
                filter: `chat_id=eq.${chatId}`,
            },
            (payload: { new: MessageRow }) => {
                onUpdate(payload.new)
            }
        )
    }
    channel.subscribe()

    return () => {
        supabase.removeChannel(channel)
    }
}
