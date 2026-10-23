import { supabase } from "@/integrations/supabase/client"
import { uniqueChannelTopic } from "@/shared/services/realtimeService"
import { signKeyBundle } from "../core/crypto"
import { loadKeyPair, loadRatchetKeyPair, loadSignKeyPair } from "../core/storage"
import type { StoredKeyPair } from "../core/storage"
import { logCriticalError } from "../core/logger"

export type SyncUserKeysResult =
    | { status: "skipped" }
    | { status: "no_local_keys" }
    | { status: "exists" }
    | { status: "reuploaded" }
    | { status: "error" }

export async function syncUserKeys({
    userId,
    keyPair: overrideKeyPair,
    ratchetKeyPair: overrideRatchetKeyPair,
    signKeyPair: overrideSignKeyPair,
    logger = logCriticalError,
}: {
    userId: string | null | undefined
    keyPair?: StoredKeyPair | null
    ratchetKeyPair?: StoredKeyPair | null
    signKeyPair?: StoredKeyPair | null
    logger?: typeof logCriticalError
}): Promise<SyncUserKeysResult> {
    if (!userId) return { status: "skipped" }

    const keyPair = overrideKeyPair ?? loadKeyPair()
    const ratchetKeyPair = overrideRatchetKeyPair ?? loadRatchetKeyPair()
    const signKeyPair = overrideSignKeyPair ?? loadSignKeyPair()

    if (!keyPair || !ratchetKeyPair || !signKeyPair) {
        return { status: "no_local_keys" }
    }

    const { data, error } =
        await // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("cryptedmessage_userkeys") as any)
            .select("pubkey, updated_at")
            .eq("user_id", userId as string)
            .maybeSingle()

    if (error) {
        await logger({
            code: "KEY_SYNC_FETCH_FAILED",
            scope: "services/userKeysService",
            message: "Failed to fetch remote user keys",
            stack: String(error),
            userId,
        })
        return { status: "error" }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingKey = (data as any)?.pubkey?.key
    if (existingKey && existingKey === keyPair.publicKey) {
        return { status: "exists" }
    }
    // Key is missing or has changed (e.g. after purge + re-setup) — upsert below

    const signature = signKeyBundle(
        userId,
        keyPair.publicKey,
        ratchetKeyPair.publicKey,
        signKeyPair.secretKey
    )

    const payload = {
        user_id: userId,
        pubkey: {
            key: keyPair.publicKey,
            algo: "curve25519",
            ratchet_pubkey: ratchetKeyPair.publicKey,
            sign_pubkey: signKeyPair.publicKey,
            signature,
            signature_alg: "ed25519",
        },
        updated_at: new Date().toISOString(),
    }

    const { error: upsertError } =
        await // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("cryptedmessage_userkeys") as any).upsert([payload], {
            onConflict: "user_id",
        })

    if (upsertError) {
        await logger({
            code: "KEY_SYNC_UPLOAD_FAILED",
            scope: "services/userKeysService",
            message: "Failed to re-upload user keys",
            stack: String(upsertError),
            userId,
        })
        return { status: "error" }
    }

    return { status: "reuploaded" }
}

export async function deleteRemoteUserKeys(userId: string): Promise<void> {
    await // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from("cryptedmessage_userkeys") as any)
        .delete()
        .eq("user_id", userId as string)
}

/**
 * Dernier bundle de clés publiques d'un utilisateur. Déplacé depuis
 * hooks/useCryptedChat.ts (déplacement mécanique, règle no-restricted-imports).
 */
export async function fetchLatestUserKeyBundle(
    userId: string
): Promise<{ data: { pubkey?: unknown } | null; error: unknown }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await (supabase.from("cryptedmessage_userkeys") as any)
        .select("pubkey, updated_at")
        .eq("user_id", userId as string)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    return response
}

/**
 * Clés publiques d'un ensemble d'utilisateurs (membres d'un groupe).
 * Déplacé depuis hooks/useCryptedGroupChat.ts (déplacement mécanique).
 */
export async function fetchUserPubkeys(
    userIds: string[]
): Promise<{
    data: Array<{ user_id: string; pubkey: unknown }> | null
    error: unknown
}> {
    const { data, error } = await // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
        .from("cryptedmessage_userkeys")
        .select("user_id, pubkey")
        .in("user_id", userIds)
    return { data, error }
}

/**
 * Abonnement realtime aux changements de clés d'un utilisateur.
 * Retourne la fonction de désabonnement (removeChannel).
 */
export function subscribeToUserKeyChanges(
    userId: string,
    onChange: () => void
): () => void {
    const channel = supabase
        .channel(uniqueChannelTopic(`cryptedmessage-keys-${userId}`))
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "cryptedmessage_userkeys",
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
