import { useEffect, useState } from "react"
import { UserPlus, UserMinus, Crown, Users } from "lucide-react"
import clsx from "clsx"
import { twMerge } from "tailwind-merge"
import type { GroupMember } from "../../hooks/useGroups"
import type { CryptedUser } from "../../hooks/useCryptedUsers"
import { MemberAvatar } from "../messages/MemberAvatar"


type Props = {
    groupId: string
    currentUserId: string | null
    onLoadMembers: (groupId: string) => Promise<GroupMember[]>
    onAddMember: (groupId: string, userId: string) => Promise<boolean>
    onRemoveMember: (groupId: string, userId: string) => Promise<boolean>
    allUsers: Record<string, CryptedUser[]>
}

export function GroupMembersPanel({
    groupId,
    currentUserId,
    onLoadMembers,
    onAddMember,
    onRemoveMember,
    allUsers,
}: Props) {
    const [members, setMembers] = useState<GroupMember[]>([])
    const [loading, setLoading] = useState(true)
    const [showAddPanel, setShowAddPanel] = useState(false)
    const [addingId, setAddingId] = useState<string | null>(null)
    const [removingId, setRemovingId] = useState<string | null>(null)
    const [removeError, setRemoveError] = useState<string | null>(null)

    const currentMember = members.find((m) => m.user_id === currentUserId)
    const isAdmin = currentMember?.role === "admin"
    const memberIds = new Set(members.map((m) => m.user_id))

    const flatUsers = Object.values(allUsers)
        .flat()
        .filter((u) => !memberIds.has(u.user_id))

    const reload = async () => {
        setLoading(true)
        const data = await onLoadMembers(groupId)
        setMembers(data)
        setLoading(false)
    }

    useEffect(() => {
        void reload()
    }, [groupId])

    const handleAdd = async (userId: string) => {
        setAddingId(userId)
        const ok = await onAddMember(groupId, userId)
        if (ok) await reload()
        setAddingId(null)
        setShowAddPanel(false)
    }

    const handleRemove = async (userId: string) => {
        setRemovingId(userId)
        setRemoveError(null)
        const ok = await onRemoveMember(groupId, userId)
        if (ok) {
            await reload()
        } else {
            setRemoveError("Impossible de retirer ce membre.")
        }
        setRemovingId(null)
    }

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <Users className="h-3.5 w-3.5" />
                    {loading ? "Chargement..." : `${members.length} membres`}
                </div>
                <div className="flex gap-1">
                    {isAdmin && (
                        <button
                            type="button"
                            onClick={() => setShowAddPanel((v) => !v)}
                            className="flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-500 transition hover:border-slate-300 hover:text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:text-foreground"
                        >
                            <UserPlus className="h-3 w-3" />
                            Ajouter
                        </button>
                    )}
                </div>
            </div>

            {/* Add member picker */}
            {showAddPanel && flatUsers.length > 0 && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-2 dark:border-primary/30 dark:bg-primary/10">
                    <div className="mb-1.5 text-xs font-semibold text-primary dark:text-primary-light">
                        Ajouter un membre
                    </div>
                    <div className="max-h-32 overflow-y-auto">
                        {flatUsers.map((u) => {
                            const label = u.full_name || u.email || u.user_id
                            const isAdding = addingId === u.user_id
                            return (
                                <button
                                    key={u.user_id}
                                    type="button"
                                    disabled={!!addingId}
                                    onClick={() => void handleAdd(u.user_id)}
                                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition hover:bg-primary/10 disabled:opacity-50 dark:hover:bg-primary/20"
                                >
                                    <span className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-semibold text-primary dark:bg-primary/30 dark:text-primary-light">
                                        {label.slice(0, 2).toUpperCase()}
                                    </span>
                                    <span className="flex-1 font-medium text-slate-800 dark:text-slate-200">
                                        {label}
                                    </span>
                                    {isAdding && (
                                        <span className="text-[10px] text-primary dark:text-primary-light">
                                            Ajout...
                                        </span>
                                    )}
                                </button>
                            )
                        })}
                    </div>
                </div>
            )}

            {removeError && (
                <div className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
                    {removeError}
                </div>
            )}

            {/* Member list */}
            <div className="flex flex-col gap-1">
                {members.map((m) => {
                    const label = m.full_name || m.email || m.user_id
                    const isSelf = m.user_id === currentUserId
                    const isRemoving = removingId === m.user_id

                    return (
                        <div
                            key={m.user_id}
                            className="flex items-center gap-2.5 rounded-xl px-2 py-1.5"
                        >
                            <MemberAvatar
                                name={label}
                                avatarUrl={m.avatar_url}
                                size="sm"
                                decorative
                            />
                            <span className="flex flex-1 flex-col">
                                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                    {label}
                                    {isSelf && (
                                        <span className="ml-1 text-xs text-slate-400 dark:text-slate-500">
                                            (vous)
                                        </span>
                                    )}
                                </span>
                            </span>
                            {m.role === "admin" && (
                                <Crown className="h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
                            )}
                            {isAdmin && !isSelf && (
                                <button
                                    type="button"
                                    disabled={!!removingId}
                                    onClick={() => void handleRemove(m.user_id)}
                                    className={twMerge(
                                        clsx(
                                            "flex-shrink-0 rounded-full p-1 transition",
                                            "text-slate-300 hover:bg-rose-50 hover:text-rose-500",
                                            "dark:text-slate-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400",
                                            "disabled:opacity-40"
                                        )
                                    )}
                                    title="Retirer du groupe"
                                >
                                    {isRemoving ? (
                                        <span className="text-[10px]">...</span>
                                    ) : (
                                        <UserMinus className="h-3.5 w-3.5" />
                                    )}
                                </button>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
