import { useState } from "react"
import { X, Users, Plus } from "lucide-react"
import clsx from "clsx"
import { twMerge } from "tailwind-merge"
import type { CryptedUser } from "../../hooks/useCryptedUsers"
import type { CryptedGroup } from "../../hooks/useGroups"
import { MemberAvatar } from "../messages/MemberAvatar"


type Props = {
    open: boolean
    onClose: () => void
    allUsers: Record<string, CryptedUser[]>
    onCreate: (params: {
        name: string
        description?: string
        memberIds: string[]
    }) => Promise<CryptedGroup | null>
}

export function GroupCreateModal({ open, onClose, allUsers, onCreate }: Props) {
    const [name, setName] = useState("")
    const [description, setDescription] = useState("")
    const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    if (!open) return null

    const flatUsers = Object.values(allUsers).flat()

    const toggle = (userId: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev)
            if (next.has(userId)) {
                next.delete(userId)
            } else {
                next.add(userId)
            }
            return next
        })
    }

    const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
        e.preventDefault()
        if (!name.trim()) {
            setError("Le nom du groupe est requis.")
            return
        }
        if (selectedIds.size === 0) {
            setError("Ajoute au moins un membre.")
            return
        }
        setError(null)
        setLoading(true)
        const result = await onCreate({
            name: name.trim(),
            description: description.trim() || undefined,
            memberIds: Array.from(selectedIds),
        })
        setLoading(false)
        if (result) {
            setName("")
            setDescription("")
            setSelectedIds(new Set())
            onClose()
        } else {
            setError("Erreur lors de la creation du groupe.")
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
            {/* Backdrop */}
            <button
                type="button"
                // eslint-disable-next-line nokk-project/no-restricted-syntax -- scrim/overlay volontairement noir quel que soit le thème (design system §12.4)
                className="absolute inset-0 bg-black/50"
                onClick={onClose}
                aria-label="Fermer"
            />

            {/* Modal */}
            <div className="relative z-10 w-full max-w-md rounded-t-2xl border border-slate-200 bg-card shadow-xl sm:rounded-2xl dark:border-slate-700 dark:bg-slate-900">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
                    <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                            Nouveau groupe
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                        aria-label="Fermer"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5">
                    {/* Group name */}
                    <div className="mb-4">
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            Nom du groupe *
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Ex: Equipe projet, Support..."
                            maxLength={80}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-primary-light dark:focus:ring-primary/20"
                        />
                    </div>

                    {/* Description */}
                    <div className="mb-4">
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            Description (optionnelle)
                        </label>
                        <input
                            type="text"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Sujet, objectif du groupe..."
                            maxLength={200}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-primary-light dark:focus:ring-primary/20"
                        />
                    </div>

                    {/* Member selection */}
                    <div className="mb-4">
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            Membres ({selectedIds.size} selectionne
                            {selectedIds.size > 1 ? "s" : ""})
                        </label>
                        <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700">
                            {flatUsers.length === 0 ? (
                                <div className="p-3 text-center text-xs text-slate-400">
                                    Aucun utilisateur disponible
                                </div>
                            ) : (
                                flatUsers.map((u) => {
                                    const isSelected = selectedIds.has(
                                        u.user_id
                                    )
                                    const label =
                                        u.full_name || u.email || u.user_id
                                    return (
                                        <button
                                            key={u.user_id}
                                            type="button"
                                            onClick={() => toggle(u.user_id)}
                                            className={twMerge(
                                                clsx(
                                                    "flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition",
                                                    isSelected
                                                        ? "bg-primary/5 dark:bg-primary/15"
                                                        : "hover:bg-slate-50 dark:hover:bg-slate-800"
                                                )
                                            )}
                                        >
                                            <span className="relative flex-shrink-0">
                                                <MemberAvatar
                                                    name={label}
                                                    avatarUrl={u.avatar_url}
                                                    size="sm"
                                                    decorative
                                                    fallbackClassName={clsx(
                                                        isSelected &&
                                                            "bg-primary text-primary-foreground"
                                                    )}
                                                />
                                                {isSelected && (
                                                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                                        <svg
                                                            className="h-2.5 w-2.5"
                                                            viewBox="0 0 12 10"
                                                            fill="none"
                                                        >
                                                            <path
                                                                d="M1 5l3 3 7-7"
                                                                stroke="currentColor"
                                                                strokeWidth="2"
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                            />
                                                        </svg>
                                                    </span>
                                                )}
                                            </span>
                                            <span className="flex flex-col">
                                                <span
                                                    className={clsx(
                                                        "font-medium",
                                                        isSelected
                                                            ? "text-primary dark:text-primary-light"
                                                            : "text-slate-900 dark:text-slate-100"
                                                    )}
                                                >
                                                    {label}
                                                </span>
                                                {u.service_name && (
                                                    <span className="text-xs text-slate-400 dark:text-slate-500">
                                                        {u.service_name}
                                                    </span>
                                                )}
                                            </span>
                                        </button>
                                    )
                                })
                            )}
                        </div>
                    </div>

                    {error && (
                        <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-600 dark:border-rose-900/60 dark:bg-rose-950 dark:text-rose-300">
                            {error}
                        </div>
                    )}

                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-foreground px-4 py-2 text-sm font-semibold text-background transition hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
                        >
                            {loading ? (
                                "Creation..."
                            ) : (
                                <>
                                    <Plus className="h-4 w-4" />
                                    Creer le groupe
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
