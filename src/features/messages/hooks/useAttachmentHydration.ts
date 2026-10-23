import { useCallback, useEffect, useRef } from "react"
import { decodeBase64 } from "tweetnacl-util"
import { useLiveRef } from "@/shared/hooks/useLiveRef"
import { decryptAttachmentPayload } from "../core/crypto"
import type { StoredKeyPair } from "../core/storage"
import { downloadAttachment } from "../services/cryptedMessagesService"
import type { CryptedMessage } from "./useCryptedChat"

/**
 * Nombre de pièces jointes téléchargées et déchiffrées en parallèle.
 *
 * Le code précédent bouclait en `for … await` strict : vingt fichiers dans un
 * fil se chargeaient l'un après l'autre. Non borné, à l'inverse, on ouvrirait
 * autant de requêtes Storage que de messages visibles.
 */
const MAX_PARALLEL_DOWNLOADS = 3

export type UseAttachmentHydrationParams = {
    /**
     * Conversation courante. Changer de fil vide la mémoire des demandes :
     * les messages sont alors rechargés et redéchiffrés à neuf, donc leurs
     * pièces jointes redeviennent « en attente » et doivent pouvoir être
     * réclamées à nouveau.
     */
    conversationKey: string | null
    messages: CryptedMessage[]
    keyPair: StoredKeyPair | null
    userId: string | null | undefined
    setMessages: React.Dispatch<React.SetStateAction<CryptedMessage[]>>
    trackObjectUrl: (url: string) => void
}

/** Une pièce jointe est en attente tant qu'elle n'est ni résolue ni en erreur. */
export function isAttachmentPending(message: CryptedMessage): boolean {
    return !!(
        message.file_mime &&
        !message.image_url &&
        !message.file_url &&
        !message.attachment_error &&
        message.storage_bucket &&
        message.storage_path
    )
}

/**
 * Télécharge et déchiffre les pièces jointes **à la demande**.
 *
 * Remplace deux effets identiques (`useCryptedChat`, `useCryptedGroupChat`)
 * qui souffraient des trois mêmes défauts :
 *
 * 1. ils dépendaient de `messages` tout en appelant `setMessages` à chaque
 *    succès — donc chaque fichier résolu relançait l'effet, qui refiltrait
 *    l'historique entier : coût quadratique en nombre de pièces jointes ;
 * 2. ils téléchargeaient **tout** l'historique, y compris les fichiers situés
 *    à quarante écrans de distance ;
 * 3. strictement en série.
 *
 * Ici la liste est lue via un ref vivant (aucune dépendance), chaque message
 * n'est réclamé qu'une fois, et la file est bornée. La logique de
 * déchiffrement elle-même est reprise telle quelle.
 */
export function useAttachmentHydration({
    conversationKey,
    messages,
    keyPair,
    userId,
    setMessages,
    trackObjectUrl,
}: UseAttachmentHydrationParams) {
    const messagesRef = useLiveRef(messages)
    const keyPairRef = useLiveRef(keyPair)
    const userIdRef = useLiveRef(userId)

    // Identifiants déjà réclamés : garantit qu'un message n'est téléchargé
    // qu'une fois, même si plusieurs sources le demandent (entrée à l'écran,
    // re-render, repli sans IntersectionObserver).
    const requestedRef = useRef<Set<number>>(new Set())
    const queueRef = useRef<number[]>([])
    const runningRef = useRef(0)
    const activeRef = useRef(true)

    useEffect(() => {
        activeRef.current = true
        return () => {
            activeRef.current = false
        }
    }, [])

    // Purge au changement de conversation.
    //
    // Sans elle, revenir sur un fil déjà visité laissait ses pièces jointes en
    // squelette indéfiniment : `decryptRow` reconstruit des messages sans blob
    // (le fichier vit dans Storage, pas dans la ligne), donc ils repassent
    // « en attente » — mais leur identifiant était déjà mémorisé comme réclamé.
    useEffect(() => {
        requestedRef.current.clear()
        queueRef.current.length = 0
    }, [conversationKey])

    const failMessage = useCallback(
        (
            messageId: number,
            isImage: boolean,
            reason: "download" | "decrypt"
        ) => {
            const label =
                reason === "download"
                    ? isImage
                        ? "Impossible de télécharger l'image."
                        : "Impossible de télécharger le fichier."
                    : isImage
                      ? "Impossible de déchiffrer l'image."
                      : "Impossible de déchiffrer le fichier."
            setMessages((prev) =>
                prev.map((m) =>
                    m.id === messageId ? { ...m, attachment_error: label } : m
                )
            )
        },
        [setMessages]
    )

    const hydrate = useCallback(
        async (messageId: number) => {
            const message = messagesRef.current.find((m) => m.id === messageId)
            const currentKeyPair = keyPairRef.current
            const currentUserId = userIdRef.current
            if (!message || !currentKeyPair || !currentUserId) return
            if (!isAttachmentPending(message)) return

            const isImage = message.file_mime?.startsWith("image/") ?? false

            const { data, error: downloadError } = await downloadAttachment(
                message.storage_bucket ?? "",
                message.storage_path ?? ""
            )
            if (downloadError || !data) {
                console.error("Erreur download piece jointe:", downloadError)
                failMessage(messageId, isImage, "download")
                return
            }

            const bytes = new Uint8Array(await data.arrayBuffer())
            // Relecture après l'await : la ligne peut avoir été remplacée par
            // le realtime entre-temps.
            const row = messagesRef.current.find((m) => m.id === messageId)
            if (!row?.meta || !row.iv_b64) return

            let decrypted = decryptAttachmentPayload({
                payload: bytes,
                row,
                meta: row.meta,
                userId: currentUserId,
                keyPair: currentKeyPair,
            })

            // Repli : Storage renvoie parfois du base64 texte au lieu d'octets
            // bruts (héritage / bizarrerie d'encodage).
            if (!decrypted) {
                const asText = new TextDecoder().decode(bytes)
                const isBase64 =
                    /^[A-Za-z0-9+/=\s]+$/.test(asText) &&
                    asText.trim().length % 4 === 0
                if (isBase64) {
                    decrypted = decryptAttachmentPayload({
                        payload: decodeBase64(asText.trim()),
                        row,
                        meta: row.meta,
                        userId: currentUserId,
                        keyPair: currentKeyPair,
                    })
                }
            }

            if (!decrypted) {
                console.error(
                    "Dechiffrement piece jointe echoue pour message",
                    messageId
                )
                failMessage(messageId, isImage, "decrypt")
                return
            }

            // Copie dans un ArrayBuffer neuf : `decrypted` peut être une vue
            // sur un buffer plus large.
            const fileBuffer = new ArrayBuffer(decrypted.byteLength)
            new Uint8Array(fileBuffer).set(decrypted)
            const blob = new Blob([fileBuffer], {
                type: message.file_mime ?? "application/octet-stream",
            })
            const url = URL.createObjectURL(blob)
            trackObjectUrl(url)
            if (!activeRef.current) return

            setMessages((prev) =>
                prev.map((m) =>
                    m.id === messageId
                        ? isImage
                            ? { ...m, image_url: url }
                            : { ...m, file_url: url }
                        : m
                )
            )
        },
        [
            failMessage,
            keyPairRef,
            messagesRef,
            setMessages,
            trackObjectUrl,
            userIdRef,
        ]
    )

    const pump = useCallback(() => {
        while (
            runningRef.current < MAX_PARALLEL_DOWNLOADS &&
            queueRef.current.length > 0
        ) {
            const messageId = queueRef.current.shift()!
            runningRef.current += 1
            void hydrate(messageId).finally(() => {
                runningRef.current -= 1
                pump()
            })
        }
    }, [hydrate])

    /**
     * Réclame le chargement d'une pièce jointe. Idempotent : les appels
     * suivants pour le même message sont ignorés.
     */
    const requestAttachment = useCallback(
        (messageId: number) => {
            if (requestedRef.current.has(messageId)) return
            requestedRef.current.add(messageId)
            queueRef.current.push(messageId)
            pump()
        },
        [pump]
    )

    return { requestAttachment }
}
