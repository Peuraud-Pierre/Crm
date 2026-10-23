import { Trash2 } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import type { CryptedMessage } from "../../hooks/useCryptedChat"
import { isAttachmentPending } from "../../hooks/useAttachmentHydration"
import {
    getMediaUrl,
    resolveMessageMediaKind,
} from "../../utils/messageMedia"
import { MemberAvatar } from "./MemberAvatar"
import { MessageMedia } from "./MessageMedia"
import { MessageTimestamp } from "./MessageTimestamp"

export type MediaAlbumProps = {
    messages: CryptedMessage[]
    isMine: boolean
    showSender?: boolean
    showAvatarGutter?: boolean
    senderName?: string | null
    senderAvatarUrl?: string | null
    onOpen: (messageId: number) => void
    onDelete?: (messageId: number) => void
    /** Ref d'observation posée sur les tuiles encore non téléchargées. */
    observeAttachment: (node: HTMLDivElement | null) => void
}

/**
 * Mosaïque de médias consécutifs d'un même expéditeur.
 *
 * Chaque tuile reste **un message chiffré distinct** : le regroupement est
 * purement visuel, ce qui évite de toucher au format de message et laisse
 * chaque photo supprimable individuellement. Envoyer cinq photos produisait
 * jusqu'ici cinq bulles pleine largeur.
 */
export function MediaAlbum({
    messages,
    isMine,
    showSender,
    showAvatarGutter,
    senderName,
    senderAvatarUrl,
    onOpen,
    onDelete,
    observeAttachment,
}: MediaAlbumProps) {
    const count = messages.length
    // Au-delà de 4, la dernière tuile porte le compteur du reste : une grille
    // de 12 vignettes minuscules ne se lit pas.
    const visible = count > 4 ? messages.slice(0, 4) : messages
    const overflow = count - visible.length

    return (
        <div
            className={cn(
                "flex w-full items-end gap-1",
                isMine ? "flex-row-reverse" : "flex-row"
            )}
        >
            {showAvatarGutter && !isMine && (
                <span className="mb-0.5 shrink-0 self-end">
                    <MemberAvatar
                        name={senderName ?? ""}
                        avatarUrl={senderAvatarUrl}
                        size="sm"
                        decorative
                    />
                </span>
            )}

            <div
                className={cn(
                    "flex min-w-0 max-w-[75%] flex-col",
                    isMine ? "items-end" : "items-start"
                )}
            >
                {showSender && senderName && (
                    <span className="mb-0.5 px-1 text-2xs font-semibold text-muted-foreground">
                        {senderName}
                    </span>
                )}

                <div
                    className={cn(
                        "grid w-64 gap-0.5 overflow-hidden rounded-2xl sm:w-72",
                        visible.length === 1 ? "grid-cols-1" : "grid-cols-2",
                        isMine ? "rounded-br-md" : "rounded-bl-md"
                    )}
                >
                    {visible.map((message, index) => {
                        const url = getMediaUrl(message)
                        const kind = resolveMessageMediaKind(message)
                        const pending = isAttachmentPending(message)
                        const isLastVisible = index === visible.length - 1
                        // Trois médias : le premier occupe toute la largeur,
                        // sinon la grille laisse un trou.
                        const spanFull =
                            visible.length === 3 && index === 0

                        return (
                            <div
                                key={message.id}
                                ref={pending ? observeAttachment : undefined}
                                data-attachment-id={
                                    pending ? message.id : undefined
                                }
                                className={cn(
                                    "group/tile relative aspect-square bg-muted",
                                    spanFull && "col-span-2 aspect-video"
                                )}
                            >
                                {url && kind ? (
                                    <button
                                        type="button"
                                        onClick={() => onOpen(message.id)}
                                        className="block h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                                        aria-label={
                                            message.file_name
                                                ? `Ouvrir ${message.file_name}`
                                                : "Ouvrir le média"
                                        }
                                    >
                                        <MessageMedia
                                            kind={kind}
                                            url={url}
                                            name={message.file_name}
                                            mime={message.file_mime}
                                            inAlbum
                                        />
                                    </button>
                                ) : (
                                    <span
                                        className="block h-full w-full animate-pulse bg-muted"
                                        role="status"
                                        aria-busy="true"
                                        aria-label="Chargement du média"
                                    />
                                )}

                                {overflow > 0 && isLastVisible && (
                                    <button
                                        type="button"
                                        onClick={() => onOpen(message.id)}
                                        // eslint-disable-next-line nokk-project/no-restricted-syntax -- voile posé sur une image, contraste indépendant du thème (§12.4)
                                        className="absolute inset-0 flex items-center justify-center bg-black/55 text-lg font-semibold text-white backdrop-blur-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                                        aria-label={`Voir les ${overflow} autres médias`}
                                    >
                                        +{overflow}
                                    </button>
                                )}

                                {onDelete && isMine && (
                                    <button
                                        type="button"
                                        onClick={() => onDelete(message.id)}
                                        className="absolute right-1 top-1 rounded-full bg-background/85 p-1 text-muted-foreground opacity-0 shadow-surface backdrop-blur-sm transition-opacity duration-fast hover:text-destructive focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover/tile:opacity-100"
                                        aria-label={
                                            message.file_name
                                                ? `Supprimer ${message.file_name}`
                                                : "Supprimer ce média"
                                        }
                                        title="Supprimer"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>
                        )
                    })}
                </div>

                <div
                    className={cn(
                        "px-1",
                        isMine ? "self-end" : "self-start"
                    )}
                >
                    <MessageTimestamp
                        createdAt={messages[messages.length - 1].createdAt}
                        isMine={isMine}
                        read={messages[messages.length - 1].read}
                    />
                </div>
            </div>
        </div>
    )
}
