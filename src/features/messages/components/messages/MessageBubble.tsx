import type { ReactNode } from "react"
import { Trash2, Reply } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import type { CryptedMessage } from "../../hooks/useCryptedChat"
import { MemberAvatar } from "./MemberAvatar"


export type MessageBubbleProps = {
    isMine: boolean
    children: ReactNode
    className?: string
    deleted?: boolean
    replyToMessage?: CryptedMessage
    onDelete?: () => void
    onReply?: () => void
    /** Nom de l'expéditeur — rendu au-dessus de la bulle si `showSender`. */
    senderName?: string | null
    senderAvatarUrl?: string | null
    /** Groupe uniquement : en-tête d'identité en tête de salve. */
    showSender?: boolean
    /** Dernier message d'une salve : porte l'avatar et la queue de bulle. */
    isLastOfRun?: boolean
    /**
     * Le contenu est un média seul (image, vidéo). La bulle perd son fond et
     * son padding : le média occupe toute la surface et porte lui-même son
     * heure. Sans ça, le fond coloré ressortait en bandeau sous l'image.
     */
    mediaOnly?: boolean
    /**
     * Réserve la colonne d'avatar à gauche. Vrai pour tout message reçu en
     * groupe — y compris au milieu d'une salve, où l'avatar est remplacé par
     * un espaceur pour que les bulles restent alignées.
     */
    showAvatarGutter?: boolean
}

export function MessageBubble({
    isMine,
    children,
    className,
    deleted,
    replyToMessage,
    onDelete,
    onReply,
    senderName,
    senderAvatarUrl,
    showSender,
    isLastOfRun = true,
    showAvatarGutter,
    mediaOnly,
}: MessageBubbleProps) {
    // Pas de gouttière en 1-à-1 : la mise en page y reste strictement celle
    // d'avant, seule la conversation de groupe gagne la colonne d'avatar.
    const withGutter = !!showAvatarGutter && !isMine

    return (
        <div
            className={cn(
                "group flex w-full items-end gap-1",
                isMine ? "flex-row-reverse" : "flex-row"
            )}
        >
            {withGutter && (
                // Espaceur quand ce n'est pas la fin de salve : garde la
                // colonne de bulles alignée sous l'avatar.
                <span className="mb-0.5 shrink-0 self-end">
                    {isLastOfRun ? (
                        <MemberAvatar
                            name={senderName ?? ""}
                            avatarUrl={senderAvatarUrl}
                            size="sm"
                            decorative
                        />
                    ) : (
                        <span className="block size-7" aria-hidden />
                    )}
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
                        "rounded-2xl text-sm",
                        mediaOnly
                            ? // `overflow-hidden` : le média est rogné par le
                              // rayon de la bulle au lieu d'en déborder.
                              "overflow-hidden leading-none"
                            : "px-3 py-2",
                        deleted && "italic opacity-60",
                        !mediaOnly &&
                            (isMine
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-foreground"),
                        // Queue de bulle : l'angle bas côté expéditeur
                        // s'aplatit sur le dernier message de la salve.
                        isLastOfRun &&
                            (isMine ? "rounded-br-md" : "rounded-bl-md"),
                        className
                    )}
                >
                    {replyToMessage && !deleted && (
                        <div
                            className={cn(
                                "mb-1.5 border-l-2 pl-2 text-2xs opacity-70",
                                // La bulle média n'a pas de padding : la
                                // citation le reprend pour ne pas coller au
                                // bord de l'image.
                                mediaOnly &&
                                    "mx-3 mt-2 leading-normal text-muted-foreground",
                                isMine
                                    ? "border-primary-foreground/40"
                                    : "border-primary/50"
                            )}
                        >
                            ↩{" "}
                            {replyToMessage.deleted_at
                                ? "[Message supprimé]"
                                : (
                                      replyToMessage.body ||
                                      replyToMessage.file_name ||
                                      "Fichier"
                                  ).slice(0, 60)}
                        </div>
                    )}
                    {children}
                </div>
            </div>

            {!deleted && (onReply || onDelete) && (
                // Toujours montées, révélées au survol ou au focus clavier :
                // un montage conditionnel sur `hover` rendait ces actions
                // inatteignables au clavier.
                <div className="flex flex-col gap-0.5 opacity-0 transition-opacity duration-fast group-hover:opacity-100 group-focus-within:opacity-100">
                    {onReply && (
                        <button
                            type="button"
                            onClick={onReply}
                            className="rounded-full p-1 text-muted-foreground transition-colors duration-fast hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            title="Répondre"
                        >
                            <Reply className="h-3.5 w-3.5" />
                        </button>
                    )}
                    {onDelete && (
                        <button
                            type="button"
                            onClick={onDelete}
                            className="rounded-full p-1 text-muted-foreground transition-colors duration-fast hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            title="Supprimer"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}
