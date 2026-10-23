import { useState } from "react"
import { Users } from "lucide-react"
import type { GroupMember } from "../../hooks/useGroups"
import type { CryptedUser } from "../../hooks/useCryptedUsers"
import { GroupMembersPanel } from "./GroupMembersPanel"

/**
 * Déclencheur du panneau « Membres » posé dans l'en-tête de conversation.
 *
 * Vivait en composant anonyme au milieu de `ChatView`, qui dépassait le seuil
 * de 400 lignes de CLAUDE.md — extraction mécanique, aucun changement de
 * comportement.
 */
export function GroupMembersTrigger({
    groupId,
    currentUserId,
    onLoadMembers,
    onAddMember,
    onRemoveMember,
    allUsers,
}: {
    groupId: string
    currentUserId: string | null
    onLoadMembers: (id: string) => Promise<GroupMember[]>
    onAddMember: (groupId: string, userId: string) => Promise<boolean>
    onRemoveMember: (groupId: string, userId: string) => Promise<boolean>
    allUsers: Record<string, CryptedUser[]>
}) {
    const [open, setOpen] = useState(false)

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors duration-fast hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
                <Users className="h-3.5 w-3.5" />
                Membres
            </button>
            {open && (
                <>
                    {/* Click-away backdrop */}
                    <button
                        type="button"
                        className="fixed inset-0 z-30"
                        onClick={() => setOpen(false)}
                        aria-label="Fermer"
                    />
                    <div className="absolute right-0 top-full z-40 mt-2 w-72 rounded-2xl border border-border bg-popover p-4 text-popover-foreground shadow-raised">
                        <GroupMembersPanel
                            groupId={groupId}
                            currentUserId={currentUserId}
                            onLoadMembers={onLoadMembers}
                            onAddMember={onAddMember}
                            onRemoveMember={onRemoveMember}
                            allUsers={allUsers}
                        />
                    </div>
                </>
            )}
        </div>
    )
}
