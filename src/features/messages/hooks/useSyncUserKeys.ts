import { useEffect } from "react"
import { logCriticalError } from "../core/logger"
import { syncUserKeys } from "../services/userKeysService"
import type { StoredKeyPair } from "../core/storage"

/**
 * Keeps the current user's public key bundle in sync with the DB.
 * Called by both useCryptedChat and useCryptedGroupChat.
 */
export function useSyncUserKeys({
    userId,
    keyPair,
    ratchetKeyPair,
    signKeyPair,
    scope,
}: {
    userId: string | null | undefined
    keyPair: StoredKeyPair | null
    ratchetKeyPair: StoredKeyPair | null
    signKeyPair: StoredKeyPair | null
    scope: string
}) {
    useEffect(() => {
        if (!userId) return
        void syncUserKeys({ userId, keyPair, ratchetKeyPair, signKeyPair }).catch(
            (error) => {
                void logCriticalError({
                    code: "KEY_SYNC_UNHANDLED",
                    scope,
                    message: "Unhandled key sync error",
                    stack: String(error),
                    userId,
                })
            }
        )
    }, [keyPair, ratchetKeyPair, signKeyPair, userId, scope])
}
