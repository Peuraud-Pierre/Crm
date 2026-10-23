import clsx from "clsx"
import { MessageSquare } from "lucide-react"
import { twMerge } from "tailwind-merge"
import { MemberAvatar } from "./messages/MemberAvatar"
import type { ActiveConversation } from "./ChatUsersSidebar"

/**
 * Bloc « Conversations » de la barre latérale : les échanges 1-à-1 récents ou
 * porteurs de non-lus, remontés en tête de liste.
 *
 * Extrait de `ChatUsersSidebar`, qui dépassait le seuil de 400 lignes de
 * CLAUDE.md. Déplacement mécanique : aucun changement de comportement, les
 * deux fonctions dont le bloc dépendait deviennent des props.
 */
export function ActiveConversationsSection({
    activeConversations,
    selectedRecipientId,
    handleSelectUser,
    formatRelative,
}: {
    activeConversations: ActiveConversation[]
    selectedRecipientId: string | null
    handleSelectUser: (userId: string) => void
    formatRelative: (iso: string | null) => string
}) {
    if (activeConversations.length === 0) return null

    return (
        <div className="mb-3">
            <div className="px-4 pb-2 pt-1">
                <span className="flex items-center gap-1 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <MessageSquare className="h-3 w-3" />
                    Conversations
                </span>
            </div>

            {activeConversations.map(
                ({ user: profile, lastMessageAt, unreadCount }) => {
                    const isActive =
                        selectedRecipientId === profile.user_id
                    const label =
                        profile.full_name ||
                        profile.email ||
                        profile.user_id
                    const isOnline = profile.status === "active"
                    return (
                        <button
                            key={`conv-${profile.user_id}`}
                            type="button"
                            className={twMerge(
                                clsx(
                                    "mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm outline-none transition-colors duration-fast focus-visible:ring-2 focus-visible:ring-primary",
                                    isActive
                                        ? "bg-primary text-primary-foreground shadow"
                                        : "hover:bg-background hover:shadow-sm"
                                )
                            )}
                            onClick={() =>
                                handleSelectUser(profile.user_id)
                            }
                            aria-current={
                                isActive ? "true" : undefined
                            }
                        >
                            <MemberAvatar
                                name={label}
                                avatarUrl={profile.avatar_url}
                                decorative
                                fallbackClassName={clsx(
                                    isActive && "bg-card/20"
                                )}
                                badge={
                                    <span
                                        data-testid="presence-dot"
                                        className={clsx(
                                            "absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2",
                                            isActive
                                                ? "bg-primary-foreground ring-primary"
                                                : isOnline
                                                  ? "bg-success ring-background"
                                                  : "bg-muted-foreground/30 ring-background"
                                        )}
                                        aria-hidden
                                    />
                                }
                            />
                            <span className="flex flex-1 flex-col overflow-hidden">
                                {/* Ligne 1 : nom (gras si non-lus) + heure du dernier message à droite */}
                                <span className="flex items-baseline justify-between gap-2">
                                    <span
                                        className={clsx(
                                            "truncate",
                                            unreadCount > 0 &&
                                                !isActive
                                                ? "font-semibold"
                                                : "font-medium",
                                            isActive
                                                ? "text-primary-foreground"
                                                : "text-foreground"
                                        )}
                                    >
                                        {label}
                                    </span>
                                    {formatRelative(
                                        lastMessageAt
                                    ) ? (
                                        <span
                                            className={clsx(
                                                "flex-shrink-0 text-2xs tabular-nums",
                                                isActive
                                                    ? "text-primary-foreground/70"
                                                    : unreadCount >
                                                        0
                                                      ? "font-semibold text-primary dark:text-primary-light"
                                                      : "text-muted-foreground"
                                            )}
                                        >
                                            {formatRelative(
                                                lastMessageAt
                                            )}
                                        </span>
                                    ) : null}
                                </span>
                                {/* Ligne 2 : présence à gauche + pastille non-lus pleine à droite */}
                                <span className="mt-0.5 flex items-center justify-between gap-2">
                                    <span
                                        className={clsx(
                                            "flex items-center gap-1.5 truncate text-xs",
                                            isActive
                                                ? "text-primary-foreground/70"
                                                : "text-muted-foreground"
                                        )}
                                    >
                                        <span
                                            className={clsx(
                                                "inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full",
                                                isActive
                                                    ? "bg-primary-foreground/70"
                                                    : isOnline
                                                      ? "bg-success"
                                                      : "bg-muted-foreground/40"
                                            )}
                                            aria-hidden
                                        />
                                        {isOnline
                                            ? "En ligne"
                                            : "Hors ligne"}
                                    </span>
                                    {unreadCount > 0 &&
                                    !isActive ? (
                                        <span
                                            className="flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-2xs font-bold tabular-nums text-primary-foreground"
                                            aria-label={`${unreadCount} message${unreadCount > 1 ? "s" : ""} non lu${unreadCount > 1 ? "s" : ""}`}
                                        >
                                            {unreadCount > 99
                                                ? "99+"
                                                : unreadCount}
                                        </span>
                                    ) : null}
                                </span>
                            </span>
                        </button>
                    )
                }
            )}
        </div>
    )
}
