import { useState, type ReactNode } from "react"
import { cn } from "@/shared/lib/utils"
import {
    CheckCircle2,
    Users,
    Edit2,
    Check,
    X,
    Trash2,
    LogOut,

} from "lucide-react"


type Props = {
    selectedRecipientId: string | null
    selectedGroupId?: string | null
    selectedGroupName?: string | null
    isGroupAdmin?: boolean
    isGroupMember?: boolean
    onUpdateGroup?: (
        groupId: string,
        updates: { name?: string }
    ) => Promise<boolean>
    onDeleteGroup?: (groupId: string) => Promise<boolean>
    onLeaveGroup?: (groupId: string) => Promise<boolean>
    onGroupActionSuccess?: () => void
    setShowUsers: (value: boolean) => void
    showBundleSynced: boolean
    bundleSynced: boolean
    securityPanel: ReactNode
    groupMembersPanel?: ReactNode
}

export function ChatHeader({
    selectedRecipientId,
    selectedGroupId,
    selectedGroupName,
    isGroupAdmin,
    isGroupMember,
    onUpdateGroup,
    onDeleteGroup,
    onLeaveGroup,
    onGroupActionSuccess,
    setShowUsers,
    showBundleSynced,
    bundleSynced,
    securityPanel,
    groupMembersPanel,
}: Props) {
    const [isEditing, setIsEditing] = useState(false)
    const [editingName, setEditingName] = useState(selectedGroupName ?? "")
    const [isUpdating, setIsUpdating] = useState(false)
    const [showActionConfirm, setShowActionConfirm] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)

    const isGroup = !!selectedGroupId
    const hasConversation = !!selectedRecipientId || isGroup

    const handleSaveName = async () => {
        if (!editingName.trim() || !selectedGroupId || !onUpdateGroup) return
        setIsUpdating(true)
        const ok = await onUpdateGroup(selectedGroupId, {
            name: editingName.trim(),
        })
        setIsUpdating(false)
        if (ok) {
            setIsEditing(false)
        }
    }

    const handleCancel = () => {
        setEditingName(selectedGroupName ?? "")
        setIsEditing(false)
    }

    const handleGroupAction = async () => {
        if (!selectedGroupId) return
        setIsProcessing(true)

        let ok = false
        if (isGroupAdmin && onDeleteGroup) {
            ok = await onDeleteGroup(selectedGroupId)
        } else if (onLeaveGroup) {
            ok = await onLeaveGroup(selectedGroupId)
        }

        setIsProcessing(false)
        if (ok) {
            setShowActionConfirm(false)
            onGroupActionSuccess?.()
        }
    }

    return (
        <header
            className="border-b border-border/60 px-4 py-3"
            role="banner"
        >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex-1">
                    {isGroup && isEditing ? (
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") void handleSaveName()
                                    if (e.key === "Escape") handleCancel()
                                }}
                                disabled={isUpdating}
                                className="h-8 flex-1 rounded-lg border border-primary bg-primary/5 px-2 text-sm font-semibold text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none disabled:opacity-50 dark:border-primary/50 dark:bg-primary/10"
                                autoFocus
                            />
                            <button
                                type="button"
                                disabled={isUpdating}
                                onClick={() => void handleSaveName()}
                                className="rounded-lg p-1 text-success transition-colors duration-fast hover:bg-success-light disabled:opacity-50"
                                title="Valider"
                            >
                                <Check className="h-4 w-4" />
                            </button>
                            <button
                                type="button"
                                disabled={isUpdating}
                                onClick={handleCancel}
                                className="rounded-lg p-1 text-destructive transition-colors duration-fast hover:bg-destructive-light disabled:opacity-50"
                                title="Annuler"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5">
                            <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                                {isGroup && (
                                    <Users className="h-4 w-4 text-primary" />
                                )}
                                <span>
                                    {isGroup
                                        ? (selectedGroupName ?? "Groupe")
                                        : "Chat chiffre"}
                                </span>
                                {isGroup && isGroupAdmin && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setEditingName(
                                                selectedGroupName ?? ""
                                            )
                                            setIsEditing(true)
                                        }}
                                        className="rounded p-1 text-muted-foreground transition-colors duration-fast hover:bg-accent hover:text-accent-foreground"
                                        title="Renommer le groupe"
                                    >
                                        <Edit2 className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                        {hasConversation
                            ? isGroup
                                ? "Conversation de groupe chiffree."
                                : "Conversation securisee active."
                            : "Selectionne un utilisateur a gauche (ou un groupe)."}
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        className="rounded-full border border-border p-1.5 text-muted-foreground transition-colors duration-fast hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 lg:hidden"
                        onClick={() => setShowUsers(true)}
                        aria-label="Liste des utilisateurs"
                    >
                        <Users className="h-4 w-4" />
                    </button>
                    {isGroup && isGroupMember && !showActionConfirm && (
                        <button
                            type="button"
                            onClick={() => setShowActionConfirm(true)}
                            className={cn(
                                "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0 disabled:opacity-40",
                                isGroupAdmin
                                    ? "border-destructive/30 text-destructive"
                                    : "border-border text-muted-foreground"
                            )}
                            title={
                                isGroupAdmin
                                    ? "Supprimer le groupe"
                                    : "Quitter le groupe"
                            }
                        >
                            {isGroupAdmin ? (
                                <Trash2 className="h-3 w-3" />
                            ) : (
                                <LogOut className="h-3 w-3" />
                            )}
                            {isGroupAdmin ? "Supprimer" : "Quitter"}
                        </button>
                    )}
                    {isGroup && isGroupMember && showActionConfirm && (
                        <div
                            className={cn(
                                "flex items-center gap-2 rounded-full border px-3 py-1",
                                isGroupAdmin
                                    ? "border-destructive/30 bg-destructive/10"
                                    : "border-border bg-muted"
                            )}
                        >
                            <span
                                className={cn(
                                    "text-xs font-semibold",
                                    isGroupAdmin
                                        ? "text-destructive"
                                        : "text-muted-foreground"
                                )}
                            >
                                {isGroupAdmin ? "Supprimer ?" : "Quitter ?"}
                            </span>
                            <button
                                type="button"
                                disabled={isProcessing}
                                onClick={() => void handleGroupAction()}
                                className={cn(
                                    "rounded px-2 py-0.5 text-xs font-semibold transition disabled:opacity-50",
                                    isGroupAdmin
                                        ? "bg-destructive text-destructive-foreground"
                                        : "bg-muted-foreground text-background"
                                )}
                            >
                                {isProcessing ? "..." : "Oui"}
                            </button>
                            <button
                                type="button"
                                disabled={isProcessing}
                                onClick={() => setShowActionConfirm(false)}
                                className={cn(
                                    "rounded px-2 py-0.5 text-xs font-semibold transition disabled:opacity-50",
                                    isGroupAdmin
                                        ? "text-destructive"
                                        : "text-muted-foreground"
                                )}
                            >
                                Non
                            </button>
                        </div>
                    )}
                    {isGroup && groupMembersPanel}
                    {showBundleSynced && bundleSynced ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success-light px-2.5 py-1 text-2xs font-semibold text-success">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Synchronise
                        </span>
                    ) : null}
                    {securityPanel}
                </div>
            </div>
        </header>
    )
}
