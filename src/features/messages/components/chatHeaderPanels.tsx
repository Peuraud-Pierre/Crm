import type { ReactNode } from "react"
import { SecurityPanel } from "./security/SecurityPanel"
import { GroupMembersTrigger } from "./groups/GroupMembersTrigger"
import type { GroupMember } from "../hooks/useGroups"
import type { CryptedUser } from "../hooks/useCryptedUsers"

/**
 * Les deux encarts posés dans l'en-tête de conversation : panneau de sécurité
 * (toujours) et déclencheur des membres (en groupe seulement).
 *
 * Regroupés ici parce qu'ils ne servaient qu'à alimenter deux props de
 * `ChatHeader` et gonflaient `ChatView` au-delà du seuil de 400 lignes de
 * CLAUDE.md.
 *
 * Fonction ordinaire et non hook : elle n'appelle aucun hook, seul le préfixe
 * `use` aurait laissé croire le contraire.
 */
export function buildChatHeaderPanels({
    isDesktop,
    securityOpen,
    setSecurityOpen,
    locked,
    needsPassphrase,
    remoteBundleAvailable,
    forceBundleResync,
    purgeRemoteBundle,
    getExportKeyForQRCode,
    isGroup,
    selectedGroupId,
    currentUserId,
    loadGroupMembers,
    addMember,
    removeMember,
    allUsers,
}: {
    isDesktop: boolean
    securityOpen: boolean
    setSecurityOpen: (open: boolean) => void
    locked: boolean
    needsPassphrase: boolean
    remoteBundleAvailable: boolean
    forceBundleResync: () => Promise<void>
    purgeRemoteBundle: () => Promise<void>
    getExportKeyForQRCode: () => string | null
    isGroup: boolean
    selectedGroupId: string | null
    currentUserId: string | null
    loadGroupMembers: (id: string) => Promise<GroupMember[]>
    addMember: (groupId: string, userId: string) => Promise<boolean>
    removeMember: (groupId: string, userId: string) => Promise<boolean>
    allUsers: Record<string, CryptedUser[]>
}): { securityPanel: ReactNode; groupMembersPanel: ReactNode } {
const securityPanel = (
    <SecurityPanel
        isDesktop={isDesktop}
        open={securityOpen}
        onOpenChange={setSecurityOpen}
        locked={locked}
        needsPassphrase={needsPassphrase}
        remoteBundleAvailable={remoteBundleAvailable}
        forceBundleResync={forceBundleResync}
        purgeRemoteBundle={purgeRemoteBundle}
        getExportKeyForQRCode={getExportKeyForQRCode}
    />
)

const groupMembersPanel =
    isGroup && selectedGroupId ? (
        <GroupMembersTrigger
            groupId={selectedGroupId}
            currentUserId={currentUserId}
            onLoadMembers={loadGroupMembers}
            onAddMember={addMember}
            onRemoveMember={removeMember}
            allUsers={allUsers}
        />
    ) : null

    return { securityPanel, groupMembersPanel }
}
