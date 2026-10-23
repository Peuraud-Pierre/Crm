import { useAuth } from "@/features/auth/hooks/useAuth"
import type { Json } from "@/integrations/supabase/types"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import nacl from "tweetnacl"
import { decodeBase64 } from "tweetnacl-util"
import {
    decryptRowContent,
    encryptBinaryForGroup,
    encryptMessageForGroup,
    extractPublicKey,
    resolveMetaPayload,
    sanitizeFileName,
    serializeMeta,
} from "../core/crypto"
import { useSecurityState } from "./useSecurityState"
import {
    fetchGroupMembersWithProfiles,
    subscribeToGroupMembers,
} from "../services/groupsService"
import { fetchUserPubkeys } from "../services/userKeysService"
import {
    fetchGroupMessages,
    fetchGroupMessagesBefore,
    insertCryptedMessage,
    removeAttachment,
    softDeleteMessage,
    subscribeToChatMessages,
    uploadEncryptedAttachment,
} from "../services/cryptedMessagesService"
import { useSyncUserKeys } from "./useSyncUserKeys"
import { sortedMerge } from "../utils/messageUtils"
import { readImageDimensions } from "../utils/compressImage"
import { useAttachmentHydration } from "./useAttachmentHydration"
import type { CryptedMessage } from "./useCryptedChat"
import type { GroupMember } from "./useGroups"

export type UseCryptedGroupChatResult = {
    messages: CryptedMessage[]
    loading: boolean
    error: string | null
    chatId: string | null
    members: GroupMember[]
    sendMessage: (text: string, replyToId?: number | null) => Promise<void>
    sendFile: (file: File, replyToId?: number | null) => Promise<void>
    deleteMessage: (id: number) => Promise<void>
    hasMore: boolean
    loadMore: () => Promise<void>
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
    bundleSynced: boolean
    showMagicLinkHint: boolean
    autoUnlockAt: number | null
    remoteBundleAvailable: boolean
    forceBundleResync: () => Promise<void>
    purgeRemoteBundle: () => Promise<void>
    importFromQRCode: (exportKey: string) => Promise<boolean>
    getExportKeyForQRCode: () => string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>

/** Aligné sur la taille de page du 1-à-1 (`useCryptedChat`). */
const GROUP_PAGE_SIZE = 50

export function useCryptedGroupChat(
    groupId?: string | null
): UseCryptedGroupChatResult {
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
    const [members, setMembers] = useState<GroupMember[]>([])
    const [hasMore, setHasMore] = useState(false)
    const oldestCreatedAtRef = useRef<string | null>(null)
    const [memberKeys, setMemberKeys] = useState<Record<string, string>>({})
    // True while the initial member+key load is in progress.
    // Prevents sends before key_wraps can be built for all members.
    const [memberKeysLoading, setMemberKeysLoading] = useState(false)

    const objectUrlsRef = useRef<Set<string>>(new Set())

    // Keep this user's public key up-to-date in the DB so other members can
    // encrypt messages for them even when only group chat was opened.
    useSyncUserKeys({ userId, keyPair, ratchetKeyPair, signKeyPair, scope: "useCryptedGroupChat" })

    const chatId = useMemo(
        () => (groupId ? `group:${groupId}` : null),
        [groupId]
    )

    const trackObjectUrl = useCallback((url: string) => {
        objectUrlsRef.current.add(url)
    }, [])

    // Révoque les blobs qui ne sont plus référencés par aucun message.
    //
    // Sans cela, changer de groupe conservait en mémoire toutes les pièces
    // jointes déchiffrées des groupes précédents : ce hook reste monté pendant
    // toute la vie de ChatView, donc le nettoyage au démontage n'arrivait
    // qu'à la sortie de la messagerie. Le pendant 1-à-1 le faisait déjà.
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
            for (const url of knownUrls) URL.revokeObjectURL(url)
            knownUrls.clear()
        }
    }, [])

    const decryptRow = useCallback(
        (row: AnyRow): CryptedMessage => {
            const { meta, contentType, fileName, fileSize, storage } =
                resolveMetaPayload(row.meta)
            const { body, image_url } = decryptRowContent({
                row,
                meta,
                contentType,
                storage,
                userId,
                keyPair,
            })
            if (image_url) trackObjectUrl(image_url)

            const deletedAt = (row as AnyRow).deleted_at ?? null
            const replyToId = (row as AnyRow).reply_to_id ?? null

            return {
                id: row.id ?? 0,
                chatId: row.chat_id,
                senderId: row.sender_id ?? "",
                recipientId: row.recipient_id ?? null,
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
                message_key_b64: null,
            }
        },
        [keyPair, trackObjectUrl, userId]
    )

    const mergeMessage = useCallback((next: CryptedMessage) => {
        setMessages((prev) => sortedMerge(prev, next))
    }, [])

    // Load group members and their public keys
    useEffect(() => {
        const load = async () => {
            if (!groupId) {
                setMembers([])
                setMemberKeys({})
                setMemberKeysLoading(false)
                return
            }

            setMemberKeysLoading(true)

            const { data: memberData, error: memberError } =
                await fetchGroupMembersWithProfiles(groupId)

            if (memberError || !memberData) {
                setMemberKeysLoading(false)
                return
            }

            const memberList: GroupMember[] = memberData.map((row) => ({
                user_id: row.user_id,
                full_name: row.profiles?.full_name ?? null,
                email: row.profiles?.email ?? null,
                avatar_url: row.profiles?.avatar_url ?? null,
                role: row.role,
                joined_at: row.joined_at,
            }))
            setMembers(memberList)

            const memberIds = memberList.map((m) => m.user_id)
            const { data: keyData } = await fetchUserPubkeys(memberIds)

            const keyMap: Record<string, string> = {}
            for (const keyRow of keyData ?? []) {
                const pubkey = extractPublicKey(keyRow.pubkey)
                if (pubkey) keyMap[keyRow.user_id] = pubkey
            }
            setMemberKeys(keyMap)
            setMemberKeysLoading(false)
        }

        void load()
    }, [groupId])

    // Subscribe to member changes (e.g. someone joins)
    useEffect(() => {
        if (!groupId) return
        const unsubscribe = subscribeToGroupMembers(groupId, () => {
            // Reload members and keys on membership change
            // (trigger re-run of the load effect via a state bump would be cleaner,
            //  but a simple inline reload works here)
            void (async () => {
                const { data: keyData } = await fetchUserPubkeys(
                    members.map((m) => m.user_id)
                )
                const keyMap: Record<string, string> = {}
                for (const keyRow of keyData ?? []) {
                    const pubkey = extractPublicKey(keyRow.pubkey)
                    if (pubkey) keyMap[keyRow.user_id] = pubkey
                }
                setMemberKeys(keyMap)
            })()
        })
        return unsubscribe
    }, [groupId, members])

    // Load initial messages
    useEffect(() => {
        const fetch = async () => {
            if (!chatId || !ready || !keyPair || locked) {
                setMessages([])
                setHasMore(false)
                oldestCreatedAtRef.current = null
                return
            }

            setLoading(true)
            const { data, error: fetchError } = await fetchGroupMessages(
                chatId,
                GROUP_PAGE_SIZE
            )

            if (fetchError) {
                setError("Erreur chargement messages groupe")
                setLoading(false)
                return
            }

            // La requête trie du plus récent au plus ancien pour que `limit`
            // retienne la bonne extrémité : on remet la page à l'endroit.
            const rows = ((data as AnyRow[]) ?? []).slice().reverse()
            setMessages(rows.map(decryptRow))
            setHasMore((data?.length ?? 0) === GROUP_PAGE_SIZE)
            oldestCreatedAtRef.current = rows[0]?.created_at ?? null
            setLoading(false)
        }

        void fetch()
    }, [chatId, ready, keyPair, locked, decryptRow])

    const loadMore = useCallback(async () => {
        const oldest = oldestCreatedAtRef.current
        if (!chatId || !keyPair || !hasMore || !oldest) return
        const { data } = await fetchGroupMessagesBefore(
            chatId,
            oldest,
            GROUP_PAGE_SIZE
        )
        const rows = ((data as AnyRow[]) ?? []).slice().reverse()
        setMessages((prev) => [...rows.map(decryptRow), ...prev])
        setHasMore((data?.length ?? 0) === GROUP_PAGE_SIZE)
        if (rows.length > 0) {
            oldestCreatedAtRef.current = rows[0].created_at ?? null
        }
    }, [chatId, keyPair, hasMore, decryptRow])

    // Real-time subscription
    useEffect(() => {
        if (!chatId || locked || !keyPair) return

        const unsubscribe = subscribeToChatMessages(chatId, {
            onInsert: (row) => {
                mergeMessage(decryptRow(row))
            },
        })

        return unsubscribe
    }, [chatId, decryptRow, mergeMessage, locked, keyPair])

    // Téléchargement/déchiffrement des pièces jointes : voir
    // useAttachmentHydration. L'effet qui vivait ici dépendait de `messages`
    // tout en appelant `setMessages`, donc chaque fichier résolu le relançait
    // et refiltrait l'historique entier — et il téléchargeait tout, en série.
    const { requestAttachment } = useAttachmentHydration({
        conversationKey: chatId,
        messages,
        keyPair,
        userId,
        setMessages,
        trackObjectUrl,
    })

    const buildAvailableKeys = useCallback((): Record<string, string> => {
        const keys = { ...memberKeys }
        // Always use the in-memory keyPair for the sender — the DB value may be
        // stale (just synced) and would produce a key_wrap the sender can't open.
        if (userId && keyPair) {
            keys[userId] = keyPair.publicKey
        }
        return keys
    }, [memberKeys, userId, keyPair])

    const sendMessage = useCallback(
        async (text: string, replyToId?: number | null) => {
            if (!text.trim() || !userId || !chatId || !keyPair) return
            if (memberKeysLoading) {
                setError("Chargement des cles membres en cours...")
                return
            }
            const availableKeys = buildAvailableKeys()
            if (Object.keys(availableKeys).length === 0) {
                setError("Cles membres introuvables")
                return
            }
            setError(null)

            const messageKey = nacl.randomBytes(nacl.secretbox.keyLength)
            const payload = encryptMessageForGroup(text, keyPair, availableKeys, {
                messageKey,
            })

            const { data, error: insertError } = await insertCryptedMessage({
                chat_id: chatId,
                sender_id: userId,
                recipient_id: null,
                ciphertext_b64: payload.ciphertext_b64,
                iv_b64: payload.iv_b64,
                content_encrypted: payload.meta.algo,
                meta: serializeMeta(payload.meta) as Json,
                read: false,
                reply_to_id: replyToId ?? null,
            })

            if (insertError) {
                console.error("Erreur envoi message groupe:", insertError)
                setError("Erreur envoi message")
                return
            }

            mergeMessage(decryptRow(data as AnyRow))
        },
        [
            userId,
            chatId,
            keyPair,
            buildAvailableKeys,
            decryptRow,
            mergeMessage,
        ]
    )

    const sendFile = useCallback(
        async (file: File, replyToId?: number | null) => {
            if (!userId || !chatId || !keyPair) return
            if (memberKeysLoading) {
                setError("Chargement des cles membres en cours...")
                return
            }
            const availableKeys = buildAvailableKeys()
            if (Object.keys(availableKeys).length === 0) {
                setError("Cles membres introuvables")
                return
            }
            setError(null)

            const dimensions = await readImageDimensions(file)
            const buffer = await file.arrayBuffer()
            const bytes = new Uint8Array(buffer)
            const messageKey = nacl.randomBytes(nacl.secretbox.keyLength)
            const payload = encryptBinaryForGroup(bytes, keyPair, availableKeys, {
                messageKey,
            })

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
                console.error("Erreur upload groupe:", uploadError)
                setError("Erreur upload fichier")
                return
            }

            const { data, error: insertError } = await insertCryptedMessage({
                chat_id: chatId,
                sender_id: userId,
                recipient_id: null,
                ciphertext_b64: null,
                iv_b64: payload.iv_b64,
                content_encrypted: payload.meta.algo,
                meta: serializeMeta({
                    ...payload.meta,
                    content_type: file.type || "application/octet-stream",
                    file_name: file.name,
                    file_size: file.size,
                    storage: { bucket, path: storagePath },
                    ...(dimensions ?? {}),
                    file_ext: fileExt,
                }) as Json,
                read: false,
                reply_to_id: replyToId ?? null,
            })

            if (insertError) {
                console.error("Erreur insert fichier groupe:", insertError)
                setError("Erreur envoi fichier")
                return
            }

            mergeMessage(decryptRow(data as AnyRow))
        },
        [
            userId,
            chatId,
            keyPair,
            buildAvailableKeys,
            decryptRow,
            mergeMessage,
        ]
    )

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

    return {
        messages,
        loading,
        error,
        chatId,
        members,
        sendMessage,
        sendFile,
        deleteMessage,
        hasMore,
        loadMore,
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
