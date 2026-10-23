import { useEffect, useState } from "react"
import { SkeletonList } from "@/shared/ui/molecules/skeleton-presets"
import clsx from "clsx"
import { twMerge } from "tailwind-merge"
import { Plus, Users, UsersRound } from "lucide-react"
import type { CryptedUser } from "../hooks/useCryptedUsers"
import type { CryptedGroup, GroupWithMeta } from "../hooks/useGroups"
import { getInitials } from "../utils/messageUtils"
import { MemberAvatar } from "./messages/MemberAvatar"
import { ActiveConversationsSection } from "./ActiveConversationsSection"
import { GroupCreateModal } from "./groups/GroupCreateModal"
import { EmptyState } from "@/shared/ui/molecules/empty-state"

/** Conversation 1-à-1 active (non-lus ou échange récent) remontée en haut. */
export type ActiveConversation = {
    user: CryptedUser
    lastMessageAt: string | null
    unreadCount: number
}

/** Récence compacte « il y a … » pour le dernier message d'une conversation. */
function formatRelative(iso: string | null): string {
    if (!iso) return ""
    const diffMs = Date.now() - Date.parse(iso)
    if (Number.isNaN(diffMs)) return ""
    const min = Math.floor(diffMs / 60000)
    if (min < 1) return "à l'instant"
    if (min < 60) return `il y a ${min} min`
    const h = Math.floor(min / 60)
    if (h < 24) return `il y a ${h} h`
    const j = Math.floor(h / 24)
    if (j < 7) return `il y a ${j} j`
    return `il y a ${Math.floor(j / 7)} sem`
}

type Props = {
    showUsers: boolean
    setShowUsers: (value: boolean) => void
    groups: Record<string, CryptedUser[]>
    usersLoading: boolean
    unreadByUser: Record<string, number>
    activeConversations?: ActiveConversation[]
    selectedRecipientId: string | null
    setSelectedRecipientId: (value: string | null) => void
    chatGroups?: GroupWithMeta[]
    chatGroupsLoading?: boolean
    selectedGroupId?: string | null
    setSelectedGroupId?: (value: string | null) => void
    onCreateGroup?: (params: {
        name: string
        description?: string
        memberIds: string[]
    }) => Promise<CryptedGroup | null>
}

export function ChatUsersSidebar({
    showUsers,
    setShowUsers,
    groups,
    usersLoading,
    unreadByUser,
    activeConversations = [],
    selectedRecipientId,
    setSelectedRecipientId,
    chatGroups = [],
    chatGroupsLoading = false,
    selectedGroupId = null,
    setSelectedGroupId = () => {},
    onCreateGroup = async () => null,
}: Props) {
    const [createModalOpen, setCreateModalOpen] = useState(false)
    const [showUsersLoading, setShowUsersLoading] = useState(false)
    const [showGroupsLoading, setShowGroupsLoading] = useState(false)

    const totalUsers = Object.values(groups).reduce(
        (sum, items) => sum + items.length,
        0
    )
    const isInitialUsersLoading = usersLoading && totalUsers === 0
    const isInitialGroupsLoading = chatGroupsLoading && chatGroups.length === 0

    const handleSelectUser = (userId: string) => {
        setSelectedGroupId(null)
        setSelectedRecipientId(userId)
        setShowUsers(false)
    }

    const handleSelectGroup = (groupId: string) => {
        setSelectedRecipientId(null)
        setSelectedGroupId(groupId)
        setShowUsers(false)
    }

    useEffect(() => {
        if (!isInitialUsersLoading) {
            // Resync delayed spinner state when loading prop clears
            // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
            setShowUsersLoading(false)
            return
        }

        const timer = window.setTimeout(() => {
            setShowUsersLoading(true)
        }, 180)

        return () => window.clearTimeout(timer)
    }, [isInitialUsersLoading])

    useEffect(() => {
        if (!isInitialGroupsLoading) {
            // Resync delayed spinner state when loading prop clears
            // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
            setShowGroupsLoading(false)
            return
        }

        const timer = window.setTimeout(() => {
            setShowGroupsLoading(true)
        }, 180)

        return () => window.clearTimeout(timer)
    }, [isInitialGroupsLoading])

    return (
        <>
            {showUsers ? (
                <button
                    type="button"
                    className="absolute inset-0 z-10 backdrop-blur-sm lg:hidden"
                    onClick={() => setShowUsers(false)}
                    aria-label="Fermer la liste des utilisateurs"
                />
            ) : null}
            <aside
                className={twMerge(
                    clsx(
                        "absolute inset-y-0 left-0 z-20 flex w-[85%] max-w-sm flex-col border-r border-border bg-muted/50 shadow-2xl transition dark:bg-primary/10 lg:static lg:z-auto lg:w-72 lg:min-w-[18rem] lg:shadow-none",
                        showUsers ? "translate-x-0" : "-translate-x-full",
                        "lg:translate-x-0"
                    )
                )}
                aria-label="Conversations, groupes et contacts"
            >
                <div className="flex-shrink-0 border-b border-border px-4 py-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Messagerie chiffrée
                            </div>
                            <div className="mt-1 text-sm font-semibold text-foreground">
                                {isInitialUsersLoading && showUsersLoading
                                    ? "Chargement..."
                                    : `${totalUsers} utilisateur${totalUsers > 1 ? "s" : ""} en ligne`}
                                <span className="sr-only">
                                    {`${totalUsers} disponible${totalUsers > 1 ? "s" : ""}`}
                                </span>
                            </div>
                        </div>
                        <button
                            type="button"
                            className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition hover:text-foreground lg:hidden"
                            onClick={() => setShowUsers(false)}
                        >
                            Retour
                        </button>
                    </div>
                </div>

                <div
                    className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-2 py-2"
                    style={{ WebkitOverflowScrolling: "touch" }}
                >
                    <ActiveConversationsSection
                        activeConversations={activeConversations}
                        selectedRecipientId={selectedRecipientId}
                        handleSelectUser={handleSelectUser}
                        formatRelative={formatRelative}
                    />

                    {/* Divider */}
                    {activeConversations.length > 0 && (
                        <div className="mx-2 mb-3 border-t border-border" />
                    )}

                    {/* ── Groups section ── */}
                    <div className="mb-3">
                        <div className="flex items-center justify-between px-4 pb-2 pt-1">
                            <span className="flex items-center gap-1 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                                <Users className="h-3 w-3" />
                                Groupes
                            </span>
                            <button
                                type="button"
                                onClick={() => setCreateModalOpen(true)}
                                className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs font-semibold text-muted-foreground transition hover:border-primary/40 hover:text-primary"
                                title="Créer un groupe"
                            >
                                <Plus className="h-3 w-3" />
                                Nouveau
                            </button>
                        </div>

                        {isInitialGroupsLoading ? (
                            showGroupsLoading ? (
                                <SkeletonList rows={3} avatar className="px-2 py-1" label="Chargement des groupes…" />
                            ) : null
                        ) : chatGroups.length === 0 ? (
                            <EmptyState
                                size="sm"
                                icon={UsersRound}
                                title="Aucun groupe"
                                action={{
                                    label: "Nouveau groupe",
                                    onClick: () => setCreateModalOpen(true),
                                    icon: Plus,
                                }}
                                className="rounded-xl border border-dashed border-border"
                            />
                        ) : (
                            chatGroups.map((g) => {
                                const isActive = selectedGroupId === g.id
                                const initials = getInitials(g.name)
                                return (
                                    <button
                                        key={g.id}
                                        type="button"
                                        className={twMerge(
                                            clsx(
                                                "mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm outline-none transition-colors duration-fast focus-visible:ring-2 focus-visible:ring-primary",
                                                isActive
                                                    ? "bg-primary text-primary-foreground shadow"
                                                    : "hover:bg-background hover:shadow-sm"
                                            )
                                        )}
                                        onClick={() => handleSelectGroup(g.id)}
                                        aria-current={
                                            isActive ? "true" : undefined
                                        }
                                    >
                                        <span
                                            className={twMerge(
                                                clsx(
                                                    "inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors duration-fast",
                                                    isActive
                                                        ? "bg-card/20 text-primary-foreground"
                                                        : "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-light"
                                                )
                                            )}
                                        >
                                            {initials}
                                        </span>
                                        <span className="flex flex-1 flex-col overflow-hidden">
                                            <span
                                                className={clsx(
                                                    "truncate font-medium",
                                                    isActive
                                                        ? "text-primary-foreground"
                                                        : "text-foreground"
                                                )}
                                            >
                                                {g.name}
                                            </span>
                                            {g.description && (
                                                <span
                                                    className={clsx(
                                                        "truncate text-xs",
                                                        isActive
                                                            ? "text-primary-foreground/60"
                                                            : "text-muted-foreground"
                                                    )}
                                                >
                                                    {g.description}
                                                </span>
                                            )}
                                        </span>
                                    </button>
                                )
                            })
                        )}
                    </div>

                    {/* Divider */}
                    <div className="mx-2 mb-3 border-t border-border" />

                    {/* ── Users section ── */}
                    {Object.entries(groups).map(([serviceName, members]) => (
                        <div key={serviceName} className="mb-3">
                            <div className="px-2 pb-1 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                                {serviceName}
                            </div>
                            {members.map((profile) => {
                                const isActive =
                                    selectedRecipientId === profile.user_id
                                const unreadCount =
                                    unreadByUser[profile.user_id] ?? 0
                                const label =
                                    profile.full_name ||
                                    profile.email ||
                                    profile.user_id
                                const isOnline = profile.status === "active"
                                return (
                                    <button
                                        key={profile.user_id}
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
                                        <span className="flex flex-1 flex-col">
                                            <span className="flex items-center justify-between gap-2">
                                                <span
                                                    className={clsx(
                                                        "font-medium",
                                                        isActive
                                                            ? "text-primary-foreground"
                                                            : "text-foreground"
                                                    )}
                                                >
                                                    {label}
                                                </span>
                                                {unreadCount > 0 &&
                                                !isActive ? (
                                                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-3xs font-semibold text-primary dark:bg-primary/20 dark:text-primary-light">
                                                        +{unreadCount}
                                                    </span>
                                                ) : null}
                                            </span>
                                            <span
                                                className={clsx(
                                                    "text-xs",
                                                    isActive
                                                        ? "text-primary-foreground/70"
                                                        : "text-muted-foreground"
                                                )}
                                            >
                                                {isOnline
                                                    ? "En ligne"
                                                    : "Hors ligne"}
                                            </span>
                                        </span>
                                    </button>
                                )
                            })}
                        </div>
                    ))}
                </div>
            </aside>

            <GroupCreateModal
                open={createModalOpen}
                onClose={() => setCreateModalOpen(false)}
                allUsers={groups}
                onCreate={onCreateGroup}
            />
        </>
    )
}
