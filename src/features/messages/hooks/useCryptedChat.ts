import { useAuth } from "@/features/auth/hooks/useAuth"
import type { Json } from "@/integrations/supabase/types"
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type Dispatch,
    type SetStateAction,
} from "react"
import { decodeBase64, encodeBase64 } from "tweetnacl-util"
import { logCriticalError } from "../core/logger"
import { useSecurityState } from "./useSecurityState"
import { useSyncUserKeys } from "./useSyncUserKeys"
import { sortedMerge } from "../utils/messageUtils"
import { readImageDimensions } from "../utils/compressImage"
import { useAttachmentHydration } from "./useAttachmentHydration"
import {
    buildConversationId,
    decryptRowContent,
    encryptBinary,
    encryptMessage,
    extractPublicKey,
    extractRatchetPublicKey,
    extractSignPublicKey,
    extractSignature,
    resolveMetaPayload,
    sanitizeFileName,
    serializeMeta,
    verifyKeyBundle,
    type MessageMeta,
} from "../core/crypto"
import {
    clearRatchetState,
    readRatchetState,
    writeRatchetState,
    type StoredKeyPair,
} from "../core/storage"
import {
    fetchLatestMessages,
    fetchMessagesBefore,
    insertCryptedMessage,
    markMessageRead,
    markThreadMessagesRead,
    removeAttachment,
    softDeleteMessage,
    subscribeToChatMessages,
    uploadEncryptedAttachment,
    type MessageInsert,
    type MessageRow,
} from "../services/cryptedMessagesService"
import {
    fetchLatestUserKeyBundle,
    subscribeToUserKeyChanges,
} from "../services/userKeysService"

export type CryptedMessage = {
    id: number
    chatId: string | null
    senderId: string
    recipientId: string | null
    body: string
    createdAt: string
    isMine: boolean
    read?: boolean
    deleted_at?: string | null
    reply_to_id?: number | null
    image_url?: string
    file_url?: string
    file_name?: string | null
    file_mime?: string | null
    file_size?: number | null
    storage_bucket?: string | null
    storage_path?: string | null
    iv_b64?: string | null
    meta?: MessageMeta | null
    message_key_b64?: string | null
    attachment_error?: string | null
}

// Les accès Supabase (table cryptedmessage, storage, realtime) vivent dans
// services/cryptedMessagesService.ts et services/userKeysService.ts.

type AttachmentMessage = {
    id: number
    file_mime?: string | null
    image_url?: string
    file_url?: string
    storage_bucket?: string | null
    storage_path?: string | null
    meta?: MessageMeta | null
    iv_b64?: string | null
    message_key_b64?: string | null
    attachment_error?: string | null
}

type UseMessageSenderParams<TMessage> = {
    chatId: string | null
    recipientId?: string | null
    userId: string | null | undefined
    keyPair: StoredKeyPair | null
    ratchetKeyPair: StoredKeyPair | null
    recipientPublicKey: string | null
    recipientRatchetPublicKey: string | null
    decryptRow: (row: MessageRow) => TMessage
    mergeMessage: (message: TMessage) => void
    setError: (value: string | null) => void
}

type UseMessageAttachmentsParams<T extends AttachmentMessage> = {
    /** Identifie la conversation : sa mémoire de demandes est purgée au changement. */
    conversationKey: string | null
    messages: T[]
    keyPair: StoredKeyPair | null
    userId: string | null | undefined
    setMessages: Dispatch<SetStateAction<T[]>>
}

export type UseCryptedChatResult = {
    messages: CryptedMessage[]
    loading: boolean
    error: string | null
    chatId: string | null
    recipientPublicKey: string | null
    sendMessage: (text: string, replyToId?: number | null) => Promise<void>
    sendFile: (file: File, replyToId?: number | null) => Promise<void>
    deleteMessage: (id: number) => Promise<void>
    loadMore: () => Promise<void>
    hasMore: boolean
    /** Réclame le chargement d'une pièce jointe entrée à l'écran. */
    requestAttachment: (messageId: number) => void
    user: ReturnType<typeof useAuth>["user"]
    locked: boolean
    unlocking: boolean
    unlockError: string | null
    unlock: (passphrase: string) => Promise<boolean>
    needsPassphrase: boolean
    needsPinSetup: boolean
    setupPin: (pin: string) => Promise<boolean>
    setupInProgress: boolean
    setupError: string | null
    markThreadRead: () => Promise<void>
    bundleSynced: boolean
    showMagicLinkHint: boolean
    autoUnlockAt: number | null
    remoteBundleAvailable: boolean
    forceBundleResync: () => Promise<void>
    purgeRemoteBundle: () => Promise<void>
    importFromQRCode: (exportKey: string) => Promise<boolean>
    getExportKeyForQRCode: () => string | null
}

function useRecipientKeysInternal({
    recipientId,
    setError,
}: {
    recipientId?: string | null
    setError: (value: string | null) => void
}) {
    const [recipientPublicKey, setRecipientPublicKey] = useState<string | null>(
        null
    )
    const [recipientRatchetPublicKey, setRecipientRatchetPublicKey] = useState<
        string | null
    >(null)

    const loadRecipientKey = useCallback(async () => {
        if (!recipientId) {
            setRecipientPublicKey(null)
            setRecipientRatchetPublicKey(null)
            setError(null)
            return
        }

        const { data, error: fetchError } =
            await fetchLatestUserKeyBundle(recipientId)

        if (fetchError) {
            console.error("Erreur cle publique:", fetchError)
            setRecipientPublicKey(null)
            return
        }

        const key = extractPublicKey(data?.pubkey)
        const ratchetKey = extractRatchetPublicKey(data?.pubkey)
        const signKey = extractSignPublicKey(data?.pubkey)
        const signature = extractSignature(data?.pubkey)
        if (!key) {
            setRecipientPublicKey(null)
            setRecipientRatchetPublicKey(null)
            return
        }

        if (signKey && signature && ratchetKey) {
            const isValid = verifyKeyBundle(
                recipientId,
                key,
                ratchetKey,
                signature,
                signKey
            )
            if (!isValid) {
                setError("Signature cle publique invalide.")
                setRecipientPublicKey(null)
                setRecipientRatchetPublicKey(null)
                return
            }
        }

        setError(null)
        setRecipientPublicKey(key)
        setRecipientRatchetPublicKey(ratchetKey ?? key)
    }, [recipientId, setError])

    useEffect(() => {
        void loadRecipientKey()
    }, [loadRecipientKey])

    useEffect(() => {
        if (!recipientId) return
        return subscribeToUserKeyChanges(recipientId, () => {
            void loadRecipientKey()
        })
    }, [loadRecipientKey, recipientId])

    return { recipientPublicKey, recipientRatchetPublicKey }
}

function useMessageAttachmentsInternal<T extends AttachmentMessage>({
    conversationKey,
    messages,
    keyPair,
    userId,
    setMessages,
}: UseMessageAttachmentsParams<T>) {
    const objectUrlsRef = useRef<Set<string>>(new Set())

    const trackObjectUrl = useCallback((url: string) => {
        objectUrlsRef.current.add(url)
    }, [])

    useEffect(() => {
        if (typeof window === "undefined") return
        const activeUrls = new Set<string>()
        for (const message of messages) {
            if (message.image_url) activeUrls.add(message.image_url)
            if (message.file_url) activeUrls.add(message.file_url)
        }
        const knownUrls = objectUrlsRef.current
        for (const url of Array.from(knownUrls)) {
            if (!activeUrls.has(url)) {
                URL.revokeObjectURL(url)
                knownUrls.delete(url)
            }
        }
    }, [messages])

    useEffect(() => {
        const knownUrls = objectUrlsRef.current
        return () => {
            for (const url of knownUrls) {
                URL.revokeObjectURL(url)
            }
            knownUrls.clear()
        }
    }, [])

    // Téléchargement/déchiffrement des pièces jointes : voir
    // useAttachmentHydration (l'effet qui vivait ici dépendait de `messages`
    // tout en appelant `setMessages`, donc il se relançait à chaque fichier
    // résolu et refiltrait tout l'historique).
    const { requestAttachment } = useAttachmentHydration({
        conversationKey,
        messages: messages as unknown as CryptedMessage[],
        keyPair,
        userId,
        setMessages: setMessages as unknown as React.Dispatch<
            React.SetStateAction<CryptedMessage[]>
        >,
        trackObjectUrl,
    })

    return { trackObjectUrl, requestAttachment }
}

function useMessageSenderInternal<TMessage>({
    chatId,
    recipientId,
    userId,
    keyPair,
    ratchetKeyPair,
    recipientPublicKey,
    recipientRatchetPublicKey,
    decryptRow,
    mergeMessage,
    setError,
}: UseMessageSenderParams<TMessage>) {
    const sendPlainMessage = useCallback(
        async (text: string, replyToId?: number | null) => {
            if (!text.trim()) return
            if (!userId || !recipientId || !chatId) return
            if (!keyPair) {
                setError("Cle chiffrement indisponible")
                return
            }
            if (!recipientPublicKey) {
                setError("Cle publique destinataire introuvable")
                return
            }
            if (!ratchetKeyPair || !recipientRatchetPublicKey) {
                setError("Ratchet DH indisponible")
                return
            }

            // Ratchet security disabled - use standard key encryption only
            const messageKey = new Uint8Array(32)
            crypto.getRandomValues(messageKey)

            const payload = encryptMessage(
                text,
                userId,
                recipientId,
                keyPair,
                recipientPublicKey,
                {
                    messageKey,
                }
            )

            const insertPayload: MessageInsert = {
                chat_id: chatId,
                sender_id: userId,
                recipient_id: recipientId,
                ciphertext_b64: payload.ciphertext_b64,
                iv_b64: payload.iv_b64,
                content_encrypted: payload.meta.algo,
                meta: serializeMeta(payload.meta) as Json,
                read: false,
                reply_to_id: replyToId ?? null,
            }

            const { data, error: insertError } =
                await insertCryptedMessage(insertPayload)

            if (insertError) {
                console.error("Erreur envoi message:", insertError)
                setError("Erreur envoi message")
                throw new Error(insertError.message || "Erreur envoi message")
            }

            mergeMessage(decryptRow(data as unknown as MessageRow))
        },
        [
            chatId,
            decryptRow,
            keyPair,
            mergeMessage,
            recipientId,
            recipientPublicKey,
            recipientRatchetPublicKey,
            ratchetKeyPair,
            setError,
            userId,
        ]
    )

    const sendMessage = useCallback(
        async (text: string, replyToId?: number | null) => {
            if (!text.trim()) return
            if (!userId || !recipientId || !chatId) return
            if (!keyPair) {
                setError("Cle chiffrement indisponible")
                return
            }
            if (!recipientPublicKey || !recipientRatchetPublicKey) {
                setError("Cle publique destinataire introuvable")
                return
            }
            setError(null)
            await sendPlainMessage(text, replyToId)
        },
        [
            chatId,
            keyPair,
            recipientId,
            recipientPublicKey,
            recipientRatchetPublicKey,
            sendPlainMessage,
            setError,
            userId,
        ]
    )

    const sendFile = useCallback(
        async (file: File, replyToId?: number | null) => {
            if (!userId || !recipientId || !chatId) return
            if (!keyPair) {
                setError("Cle chiffrement indisponible")
                return
            }
            if (!recipientPublicKey) {
                setError("Cle publique destinataire introuvable")
                return
            }
            if (!ratchetKeyPair || !recipientRatchetPublicKey) {
                setError("Ratchet DH indisponible")
                return
            }

            const previousRatchet = chatId ? readRatchetState(chatId) : null
            const dimensions = await readImageDimensions(file)
            const buffer = await file.arrayBuffer()
            const bytes = new Uint8Array(buffer)

            // Ratchet security disabled - use standard key encryption only
            const messageKey = new Uint8Array(32)
            crypto.getRandomValues(messageKey)

            const payload = encryptBinary(
                bytes,
                userId,
                recipientId,
                keyPair,
                recipientPublicKey,
                {
                    messageKey,
                }
            )

            const bucket = "cryptedmessage"
            const safeChatId = chatId.replace(/[^a-zA-Z0-9_-]/g, "_")
            const safeFileName = sanitizeFileName(file.name || "file")
            const fileExt = safeFileName.split(".").pop() ?? "bin"
            const storagePath = `${safeChatId}/${Date.now()}-${Math.random()
                .toString(16)
                .slice(2)}-${safeFileName}`

            const ciphertextBytes = decodeBase64(payload.ciphertext_b64)
            const uploadBuffer = new ArrayBuffer(ciphertextBytes.byteLength)
            new Uint8Array(uploadBuffer).set(ciphertextBytes)
            const ciphertextBlob = new Blob([uploadBuffer], {
                type: "application/octet-stream",
            })
            const { error: uploadError } = await uploadEncryptedAttachment(
                bucket,
                storagePath,
                ciphertextBlob
            )

            if (uploadError) {
                console.error("Erreur upload image:", uploadError)
                setError("Erreur upload image")
                if (chatId) {
                    if (previousRatchet) {
                        writeRatchetState(chatId, previousRatchet)
                    } else {
                        clearRatchetState(chatId)
                    }
                }
                throw new Error(uploadError.message || "Erreur upload fichier")
            }

            const insertPayload: MessageInsert = {
                chat_id: chatId,
                sender_id: userId,
                recipient_id: recipientId,
                ciphertext_b64: null,
                iv_b64: payload.iv_b64,
                content_encrypted: payload.meta.algo,
                meta: serializeMeta({
                    ...payload.meta,
                    content_type: file.type || "application/octet-stream",
                    file_name: file.name,
                    file_size: file.size,
                    storage: { bucket, path: storagePath },
                    file_ext: fileExt,
                    ...(dimensions ?? {}),
                }) as Json,
                read: false,
                reply_to_id: replyToId ?? null,
            }

            const { data, error: insertError } =
                await insertCryptedMessage(insertPayload)

            if (insertError) {
                console.error("Erreur envoi fichier:", insertError)
                setError("Erreur envoi fichier")
                if (chatId) {
                    if (previousRatchet) {
                        writeRatchetState(chatId, previousRatchet)
                    } else {
                        clearRatchetState(chatId)
                    }
                }
                throw new Error(insertError.message || "Erreur envoi fichier")
            }

            mergeMessage(decryptRow(data as unknown as MessageRow))
        },
        [
            chatId,
            decryptRow,
            keyPair,
            mergeMessage,
            recipientId,
            recipientPublicKey,
            recipientRatchetPublicKey,
            ratchetKeyPair,
            setError,
            userId,
        ]
    )

    return { sendMessage, sendFile }
}

export function useCryptedChat(
    recipientId?: string | null
): UseCryptedChatResult {
    const { user } = useAuth()
    const {
        keyPair,
        ratchetKeyPair,
        signKeyPair,
        ready,
        locked,
        unlocking,
        unlockError,
        unlock,
        needsPassphrase,
        needsPinSetup,
        setupPin,
        setupInProgress,
        setupError,
        userId,
        bundleSynced,
        showMagicLinkHint,
        autoUnlockAt,
        remoteBundleAvailable,
        forceBundleResync,
        purgeRemoteBundle,
        importFromQRCode,
        getExportKeyForQRCode,
    } = useSecurityState()
    const [messages, setMessages] = useState<CryptedMessage[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [hasMore, setHasMore] = useState(false)
    const oldestCreatedAtRef = useRef<string | null>(null)

    useSyncUserKeys({ userId, keyPair, ratchetKeyPair, signKeyPair, scope: "useCryptedChat" })

    const { recipientPublicKey, recipientRatchetPublicKey } =
        useRecipientKeysInternal({ recipientId, setError })

    const { trackObjectUrl, requestAttachment } = useMessageAttachmentsInternal({
        // `recipientId` plutôt que `chatId`, défini plus bas : les deux
        // identifient la conversation de façon équivalente.
        conversationKey: recipientId ?? null,
        messages,
        keyPair,
        userId,
        setMessages,
    })

    const chatId = useMemo(
        () => buildConversationId(userId, recipientId),
        [userId, recipientId]
    )

    const decryptRow = useCallback(
        (row: MessageRow): CryptedMessage => {
            const { meta, contentType, fileName, fileSize, storage } =
                resolveMetaPayload(row.meta)

            // Ratchet security disabled - use standard key encryption only
            const messageKeyOverride = null

            const { body, image_url } = decryptRowContent({
                row,
                meta,
                contentType,
                storage,
                userId,
                keyPair,
                messageKeyOverride: messageKeyOverride ?? undefined,
            })
            if (image_url) {
                trackObjectUrl(image_url)
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const deletedAt = (row as any).deleted_at ?? null
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const replyToId = (row as any).reply_to_id ?? null

            return {
                id: row.id ?? 0,
                chatId: row.chat_id,
                senderId: row.sender_id ?? "",
                recipientId: row.recipient_id,
                body: deletedAt ? "[Message supprimé]" : body,
                createdAt: row.created_at ?? new Date().toISOString(),
                isMine: row.sender_id === userId,
                read: row.read ?? false,
                deleted_at: deletedAt,
                reply_to_id: replyToId,
                image_url,
                file_url: undefined,
                file_name: fileName,
                file_mime: contentType,
                file_size: fileSize,
                storage_bucket: storage?.bucket ?? null,
                storage_path: storage?.path ?? null,
                iv_b64: row.iv_b64 ?? null,
                meta,
                message_key_b64: messageKeyOverride
                    ? encodeBase64(messageKeyOverride)
                    : null,
            }
        },
        [keyPair, trackObjectUrl, userId]
    )

    const mergeMessage = useCallback((next: CryptedMessage) => {
        setMessages((prev) => sortedMerge(prev, next))
    }, [])

    const markThreadRead = useCallback(async () => {
        if (!userId || !recipientId) return
        const { error: updateError } = await markThreadMessagesRead(
            userId,
            recipientId
        )

        if (updateError) {
            console.error("Erreur update read:", updateError)
        }
    }, [recipientId, userId])

    const loadMore = useCallback(async () => {
        if (!chatId || !keyPair || !userId || !hasMore || !oldestCreatedAtRef.current) return
        const { data } = await fetchMessagesBefore(
            chatId,
            oldestCreatedAtRef.current,
            50
        )
        const rows = (data as MessageRow[]).reverse()
        setMessages((prev) => [...rows.map(decryptRow), ...prev])
        setHasMore(data.length === 50)
        if (rows.length > 0) {
            oldestCreatedAtRef.current = rows[0].created_at ?? null
        }
    }, [chatId, keyPair, userId, hasMore, decryptRow])

    const deleteMessage = useCallback(
        async (messageId: number) => {
            if (!userId) return
            const now = new Date().toISOString()

            const target = messages.find((m) => m.id === messageId)
            if (target?.storage_bucket && target.storage_path) {
                const { error: storageErr } = await removeAttachment(
                    target.storage_bucket,
                    target.storage_path
                )
                if (storageErr) {
                    console.error("Erreur suppression storage:", storageErr)
                }
            }

            await softDeleteMessage(messageId, userId, now)
            setMessages((prev) =>
                prev.map((m) =>
                    m.id === messageId
                        ? { ...m, deleted_at: now, body: "[Message supprimé]" }
                        : m
                )
            )
        },
        [userId, messages]
    )

    const { sendMessage, sendFile } = useMessageSenderInternal({
        chatId,
        recipientId,
        userId,
        keyPair,
        ratchetKeyPair,
        recipientPublicKey,
        recipientRatchetPublicKey,
        decryptRow,
        mergeMessage,
        setError,
    })

    useEffect(() => {
        if (!userId || !chatId || !ready || !keyPair || locked) return

        const fetchMessages = async () => {
            setLoading(true)
            const { data, error: fetchError } = await fetchLatestMessages(
                chatId,
                50
            )

            if (fetchError) {
                console.error("Erreur chargement messages:", fetchError)
                setError("Erreur chargement messages")
                setLoading(false)
                return
            }

            const rows = (data as MessageRow[]).reverse()
            const decrypted = rows.map(decryptRow)
            setMessages(decrypted)
            setHasMore(data.length === 50)
            if (rows.length > 0) {
                oldestCreatedAtRef.current = rows[0].created_at ?? null
            }
            setLoading(false)
        }

        fetchMessages()
    }, [chatId, ready, keyPair, decryptRow, userId, locked])

    useEffect(() => {
        if (!chatId || locked) return
        void markThreadRead()
    }, [chatId, locked, markThreadRead])

    useEffect(() => {
        if (!error) return
        void logCriticalError({
            code: "CHAT_ERROR",
            scope: "useCryptedChat",
            message: error,
            userId,
        })
    }, [error, userId])

    useEffect(() => {
        if (!chatId || locked || !keyPair) return

        const unsubscribe = subscribeToChatMessages(chatId, {
            onInsert: (row) => {
                mergeMessage(decryptRow(row))
                if (
                    row.id &&
                    row.recipient_id === userId &&
                    row.sender_id === recipientId &&
                    !row.read
                ) {
                    void markMessageRead(row.id)
                }
            },
            onUpdate: (row) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const deletedAt = (row as any).deleted_at ?? null
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === row.id
                            ? {
                                  ...m,
                                  read: row.read ?? false,
                                  deleted_at: deletedAt,
                                  body: deletedAt ? "[Message supprimé]" : m.body,
                              }
                            : m
                    )
                )
            },
        })

        return unsubscribe
    }, [chatId, decryptRow, mergeMessage, locked, keyPair, recipientId, userId])

    return {
        messages,
        loading,
        error,
        chatId,
        recipientPublicKey,
        sendMessage,
        sendFile,
        deleteMessage,
        loadMore,
        hasMore,
        requestAttachment,
        user,
        locked,
        unlocking,
        unlockError,
        unlock,
        needsPassphrase,
        needsPinSetup,
        setupPin,
        setupInProgress,
        setupError,
        markThreadRead,
        bundleSynced,
        showMagicLinkHint,
        autoUnlockAt,
        remoteBundleAvailable,
        forceBundleResync,
        purgeRemoteBundle,
        importFromQRCode,
        getExportKeyForQRCode,
    }
}
