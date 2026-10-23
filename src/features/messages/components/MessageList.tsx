import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react"
import type { RefObject } from "react"
import type { CryptedMessage } from "../hooks/useCryptedChat"
import { getFileKind } from "../utils/messageFiles"
import { buildMessageItems } from "../utils/messageGrouping"
import { getMetaAspectRatio } from "../utils/messageFiles"
import {
    getMediaUrl,
    isRenderableVisualMedia,
    isVisualMedia,
    resolveMessageMediaKind,
} from "../utils/messageMedia"
import { isAttachmentPending } from "../hooks/useAttachmentHydration"
import { useAttachmentObserver } from "../hooks/useAttachmentObserver"
import { MessageDateSeparator } from "./messages/MessageDateSeparator"
import { MessageAttachmentPending } from "./messages/MessageAttachmentPending"
import { MessageMedia } from "./messages/MessageMedia"
import { MediaAlbum } from "./messages/MediaAlbum"
import { fileIconMap } from "./messages/fileIcons"
import { MediaLightbox } from "./messages/MediaLightbox"
import { MessageAttachment } from "./messages/MessageAttachment"
import { MessageAttachmentError } from "./messages/MessageAttachmentError"
import { MessageBubble } from "./messages/MessageBubble"
import { MessageText } from "./messages/MessageText"
import { MessageTimestamp } from "./messages/MessageTimestamp"


export type SenderIdentity = {
    name: string
    avatarUrl: string | null
}

export type SenderDirectory = Map<string, SenderIdentity>

/**
 * Libellé de l'indicateur de frappe. Les identifiants sont déjà résolus côté
 * client, il n'y a donc aucune raison de s'en tenir à « Quelqu'un ».
 */
function formatTypingLabel(
    userIds: string[],
    senders?: SenderDirectory
): string {
    const names = userIds
        .map((id) => senders?.get(id)?.name)
        .filter((name): name is string => !!name)

    if (names.length === 0) {
        return userIds.length > 1
            ? "Plusieurs personnes écrivent"
            : "Quelqu'un est en train d'écrire"
    }
    if (names.length === 1) return `${names[0]} est en train d'écrire`
    if (names.length === 2) return `${names[0]} et ${names[1]} écrivent`
    return `${names.length} personnes écrivent`
}

export function MessageList({
    messages,
    currentUserId,
    onDelete,
    onReply,
    hasMore,
    onLoadMore,
    scrollContainerRef,
    typingUserIds,
    isGroup,
    senders,
    onRequestAttachment,
}: {
    messages: CryptedMessage[]
    currentUserId?: string | null
    onDelete?: (messageId: number) => void
    onReply?: (message: CryptedMessage) => void
    hasMore?: boolean
    onLoadMore?: () => void | Promise<void>
    scrollContainerRef?: RefObject<HTMLDivElement | null>
    typingUserIds?: string[]
    /** Conversation de groupe : active l'identité de l'expéditeur. */
    isGroup?: boolean
    /** Annuaire `user_id -> identité`, construit une seule fois par ChatView. */
    senders?: SenderDirectory
    /**
     * Réclame le téléchargement d'une pièce jointe. Appelé quand la bulle
     * approche de l'écran — rien n'est téléchargé avant.
     */
    onRequestAttachment?: (messageId: number) => void
}) {
    // Galerie de la conversation : tous les médias visuels déjà déchiffrés,
    // dans l'ordre du fil. La visionneuse navigue dedans plutôt que d'être
    // limitée au média cliqué.
    const gallery = useMemo(
        () =>
            messages.filter(isRenderableVisualMedia).map((message) => ({
                id: message.id,
                url: getMediaUrl(message) as string,
                name: message.file_name,
                mime: message.file_mime,
            })),
        [messages]
    )
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

    const openMediaById = useCallback(
        (messageId: number) => {
            const index = gallery.findIndex((entry) => entry.id === messageId)
            if (index >= 0) setLightboxIndex(index)
        },
        [gallery]
    )
    const closeLightbox = useCallback(() => setLightboxIndex(null), [])
    const bottomRef = useRef<HTMLDivElement>(null)
    const prevLastIdRef = useRef<number | null>(null)
    const sentinelRef = useRef<HTMLDivElement>(null)
    const isLoadingMoreRef = useRef(false)
    const scrollSnapshotRef = useRef<{
        scrollHeight: number
        scrollTop: number
    } | null>(null)

    const triggerLoadMore = useCallback(() => {
        if (!hasMore || !onLoadMore || isLoadingMoreRef.current) return
        const el = scrollContainerRef?.current
        if (el) {
            scrollSnapshotRef.current = {
                scrollHeight: el.scrollHeight,
                scrollTop: el.scrollTop,
            }
        }
        isLoadingMoreRef.current = true
        void Promise.resolve(onLoadMore())
    }, [hasMore, onLoadMore, scrollContainerRef])

    useEffect(() => {
        if (!hasMore || !onLoadMore) return
        const sentinel = sentinelRef.current
        const root = scrollContainerRef?.current
        if (!sentinel || !root) return
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    triggerLoadMore()
                }
            },
            { root, rootMargin: "300px 0px 0px 0px" }
        )
        observer.observe(sentinel)
        return () => observer.disconnect()
    }, [hasMore, onLoadMore, scrollContainerRef, triggerLoadMore])

    const { observeAttachment } = useAttachmentObserver({
        scrollContainerRef,
        onRequestAttachment,
    })

    useLayoutEffect(() => {
        const snapshot = scrollSnapshotRef.current
        const el = scrollContainerRef?.current
        if (!snapshot || !el) return
        const delta = el.scrollHeight - snapshot.scrollHeight
        if (delta > 0) {
            el.scrollTop = snapshot.scrollTop + delta
        }
        scrollSnapshotRef.current = null
        isLoadingMoreRef.current = false
    }, [messages, scrollContainerRef])

    useEffect(() => {
        const lastMsg = messages[messages.length - 1]
        if (!lastMsg) return
        if (
            lastMsg.id !== prevLastIdRef.current &&
            lastMsg.senderId === currentUserId
        ) {
            bottomRef.current?.scrollIntoView({ behavior: "smooth" })
        }
        prevLastIdRef.current = lastMsg.id
    }, [messages, currentUserId])

    const items = useMemo(
        () => buildMessageItems(messages, { isGroup, currentUserId }),
        [messages, isGroup, currentUserId]
    )

    return (
        <>
            {hasMore && onLoadMore && (
                <>
                    <div ref={sentinelRef} aria-hidden className="h-px" />
                    <div className="flex justify-center pb-2">
                        <button
                            type="button"
                            onClick={triggerLoadMore}
                            className="rounded-full border border-border px-4 py-1.5 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-primary"
                        >
                            Charger plus
                        </button>
                    </div>
                </>
            )}
            <div className="flex flex-col gap-1" role="list">
                {items.map((item) => {
                    if (item.kind === "day") {
                        return (
                            <MessageDateSeparator
                                key={`day-${item.key}`}
                                label={item.label}
                            />
                        )
                    }

                    if (item.kind === "album") {
                        const first = item.messages[0]
                        const albumIsMine = first.senderId === currentUserId
                        const albumSender = senders?.get(first.senderId ?? "")
                        return (
                            <MediaAlbum
                                key={item.key}
                                messages={item.messages}
                                isMine={albumIsMine}
                                showSender={item.showSender}
                                showAvatarGutter={isGroup}
                                senderName={
                                    albumSender?.name ?? "Utilisateur inconnu"
                                }
                                senderAvatarUrl={albumSender?.avatarUrl}
                                onOpen={openMediaById}
                                onDelete={
                                    albumIsMine ? onDelete : undefined
                                }
                                observeAttachment={observeAttachment}
                            />
                        )
                    }

                    const { message, showSender, isLastOfRun } = item
                    const isMine = message.senderId === currentUserId
                    // Une même fonction décide de la famille pour tous les
                    // formats : image, vidéo, audio — sinon ligne de fichier.
                    const mediaKind = resolveMessageMediaKind(message)
                    const mediaUrl = getMediaUrl(message)
                    // Image et vidéo occupent seules la bulle : elle perd son
                    // fond, sinon il ressortait en bandeau sous le média.
                    const isVisualAttachment =
                        !message.deleted_at &&
                        !message.attachment_error &&
                        isVisualMedia(message.file_mime)
                    const isMediaOnly =
                        isVisualAttachment &&
                        // Vrai dès l'état d'attente : le squelette occupe la
                        // même bulle nue que le média final, sans ressaut.
                        (!!mediaUrl || isAttachmentPending(message))
                    const fileKind = getFileKind(message.file_mime)
                    const iconRenderer = fileIconMap[fileKind]
                    const icon = iconRenderer ? iconRenderer() : null
                    // Un expéditeur absent de l'annuaire (compte supprimé,
                    // membre parti avant le chargement) doit rester identifié
                    // comme « quelqu'un d'autre », pas rendre une bulle muette.
                    const sender = senders?.get(message.senderId ?? "")
                    const senderName = sender?.name ?? "Utilisateur inconnu"

                    return (
                        <MessageBubble
                            key={message.id}
                            isMine={isMine}
                            deleted={!!message.deleted_at}
                            showSender={showSender}
                            showAvatarGutter={isGroup}
                            isLastOfRun={isLastOfRun}
                            mediaOnly={isMediaOnly}
                            senderName={senderName}
                            senderAvatarUrl={sender?.avatarUrl}
                            replyToMessage={
                                message.reply_to_id
                                    ? messages.find((m) => m.id === message.reply_to_id)
                                    : undefined
                            }
                            onDelete={
                                isMine && !message.deleted_at
                                    ? () => onDelete?.(message.id)
                                    : undefined
                            }
                            onReply={
                                !message.deleted_at
                                    ? () => onReply?.(message)
                                    : undefined
                            }
                        >
                            {message.deleted_at ? (
                                <MessageText text={message.body} />
                            ) : message.attachment_error ? (
                                <MessageAttachmentError
                                    message={message.attachment_error}
                                    fileName={message.file_name}
                                />
                            ) : isAttachmentPending(message) ? (
                                // Le `data-attachment-id` est la cible de
                                // l'observateur : le téléchargement ne part
                                // que lorsque la bulle approche de l'écran.
                                <div
                                    ref={observeAttachment}
                                    data-attachment-id={message.id}
                                >
                                    <MessageAttachmentPending
                                        fileName={message.file_name}
                                        fileSize={message.file_size}
                                        isImage={isVisualAttachment}
                                        aspectRatio={getMetaAspectRatio(
                                            message.meta
                                        )}
                                    />
                                </div>
                            ) : mediaKind && mediaUrl ? (
                                <MessageMedia
                                    kind={mediaKind}
                                    url={mediaUrl}
                                    name={message.file_name}
                                    mime={message.file_mime}
                                    aspectRatio={getMetaAspectRatio(
                                        message.meta
                                    )}
                                    onOpen={() => openMediaById(message.id)}
                                    overlay={
                                        <MessageTimestamp
                                            createdAt={message.createdAt}
                                            isMine={isMine}
                                            read={message.read}
                                            compact
                                        />
                                    }
                                />
                            ) : message.file_url ? (
                                <MessageAttachment
                                    url={message.file_url}
                                    name={message.file_name}
                                    size={message.file_size}
                                    icon={icon}
                                    isMine={isMine}
                                />
                            ) : (
                                <MessageText text={message.body} />
                            )}
                            {!isMediaOnly && (
                                <MessageTimestamp
                                    createdAt={message.createdAt}
                                    isMine={isMine}
                                    read={message.read}
                                />
                            )}
                        </MessageBubble>
                    )
                })}
            </div>
            {typingUserIds && typingUserIds.length > 0 && (
                <div
                    className="flex items-center gap-2 px-1 py-1 text-xs italic text-muted-foreground"
                    role="status"
                >
                    <span className="animate-pulse" aria-hidden>
                        •••
                    </span>
                    <span>{formatTypingLabel(typingUserIds, senders)}</span>
                </div>
            )}
            <div ref={bottomRef} />

            {lightboxIndex !== null && gallery.length > 0 ? (
                <MediaLightbox
                    items={gallery}
                    index={Math.min(lightboxIndex, gallery.length - 1)}
                    onIndexChange={setLightboxIndex}
                    onClose={closeLightbox}
                />
            ) : null}
        </>
    )
}
