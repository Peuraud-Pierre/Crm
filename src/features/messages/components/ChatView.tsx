import { memo, useCallback, useEffect, useRef, useState } from "react"
import { useSearchParams } from "react-router"
import { useAuth } from "@/features/auth/hooks/useAuth"

import { useCryptedChat } from "../hooks/useCryptedChat"
import type { CryptedMessage } from "../hooks/useCryptedChat"
import { useTypingIndicator } from "../hooks/useTypingIndicator"
import { useCryptedGroupChat } from "../hooks/useCryptedGroupChat"
import { useCryptedUsers } from "../hooks/useCryptedUsers"
import { useRecentConversations } from "../hooks/useRecentConversations"
import { useGroups } from "../hooks/useGroups"
import { useGroupMembers } from "../hooks/useGroupMembers"
import { useSenderDirectory } from "../hooks/useSenderDirectory"
import { useActiveConversations } from "../hooks/useActiveConversations"
import { useDelayedLoading } from "../hooks/useDelayedLoading"
import { SecurityStateProvider } from "../hooks/useSecurityState"
import { useChatLayout } from "../hooks/useChatLayout"
import { ChatAlerts } from "./ChatAlerts"
import { ChatHeader } from "./ChatHeader"
import { PinUnlockScreen } from "./security/PinUnlockScreen"
import { PinSetupScreen } from "./security/PinSetupScreen"
import { ChatLockScreen } from "./security/ChatLockScreen"
import { ChatUsersSidebar } from "./ChatUsersSidebar"
import { buildChatHeaderPanels } from "./chatHeaderPanels"
import { MessageInput } from "./MessageInput"
import type { MessageInputHandle } from "./MessageInput"
import { useFileDropZone } from "../hooks/useFileDropZone"
import { MessageList } from "./MessageList"
import { MessagesSkeleton } from "./messages/MessagesSkeleton"
import { ChatDropOverlay } from "./ChatDropOverlay"
import { ChatEmptyState } from "./ChatEmptyState"

const ChatViewContent = memo(function ChatViewContent({
    recipientId,
}: {
    recipientId?: string
}) {
    const { user } = useAuth()
    const currentUserId = user?.user_id ?? user?.id ?? null

    // La conversation ouverte n'est PAS portée par l'URL : un identifiant
    // d'utilisateur y traînerait dans l'historique, les signets, les journaux
    // de proxy et tout lien copié. `?user=` reste accepté en entrée (lien de
    // notification) mais il est retiré de la barre d'adresse dès qu'il est lu.
    const [searchParams, setSearchParams] = useSearchParams()

    const [selectedRecipientId, setSelectedRecipientId] = useState<
        string | null
    >(recipientId ?? searchParams.get("user") ?? null)
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)

    const { groups, loading: usersLoading, unreadByUser } = useCryptedUsers()
    const recentByUser = useRecentConversations(currentUserId)

    const activeConversations = useActiveConversations({
        profilesByService: groups,
        unreadByUser,
        recentByUser,
    })
    const {
        groups: chatGroups,
        loading: chatGroupsLoading,
        createGroup,
        loadGroupMembers,
        addMember,
        removeMember,
        markGroupRead,
        updateGroup,
        deleteGroup,
        leaveGroup,
    } = useGroups()

    const isGroup = !!selectedGroupId

    const [replyTo, setReplyTo] = useState<CryptedMessage | null>(null)

    const p2pChat = useCryptedChat(isGroup ? null : selectedRecipientId)
    const groupChat = useCryptedGroupChat(isGroup ? selectedGroupId : null)
    const activeChat = isGroup ? groupChat : p2pChat

    const {
        messages,
        loading,
        error,
        sendMessage,
        sendFile,
        locked,
        needsPassphrase,
        needsPinSetup,
        setupPin,
        setupInProgress,
        setupError,
        unlocking,
        unlockError,
        unlock,
        bundleSynced,
        autoUnlockAt,
        remoteBundleAvailable,
        forceBundleResync,
        purgeRemoteBundle,
        importFromQRCode,
        getExportKeyForQRCode,
    } = activeChat

    const { deleteMessage, hasMore, loadMore } = activeChat

    const { typingUserIds, onTypingStart, onTypingStop } = useTypingIndicator(
        activeChat.chatId,
        user?.user_id ?? user?.id ?? null
    )

    const handleSend = useCallback(
        async (text: string) => {
            await sendMessage(text, replyTo?.id ?? null)
            setReplyTo(null)
            onTypingStop()
        },
        [sendMessage, replyTo, onTypingStop]
    )

    const handleSendFile = useCallback(
        async (file: File) => {
            await sendFile(file, replyTo?.id ?? null)
            setReplyTo(null)
        },
        [sendFile, replyTo]
    )

    const selectedGroup = chatGroups.find((g) => g.id === selectedGroupId)
    const groupMembers = useGroupMembers(selectedGroupId, loadGroupMembers)
    const currentMember = groupMembers.find((m) => m.user_id === currentUserId)

    const senders = useSenderDirectory({
        groupMembers,
        profilesByService: groups,
        currentUserId,
        user,
    })
    const isGroupAdmin = currentMember?.role === "admin"
    const isGroupMember = !!currentMember
    const hasActiveConversation = !!selectedRecipientId || isGroup
    const showLoadingIndicator = useDelayedLoading(
        loading && hasActiveConversation
    )
    const composerRef = useRef<MessageInputHandle | null>(null)
    const { isDragActive, dropHandlers } = useFileDropZone({
        enabled: hasActiveConversation && !locked,
        onFiles: (files) => composerRef.current?.enqueueFiles(files),
    })
    const activeConversationKey = isGroup
        ? selectedGroupId
            ? `group:${selectedGroupId}`
            : null
        : selectedRecipientId
          ? `user:${selectedRecipientId}`
          : null

    const handleReachBottom = useCallback(async () => {
        if (isGroup && selectedGroupId) {
            await markGroupRead(selectedGroupId)
        } else if (!isGroup && "markThreadRead" in activeChat) {
            await (
                activeChat as ReturnType<typeof useCryptedChat>
            ).markThreadRead()
        }
    }, [isGroup, selectedGroupId, markGroupRead, activeChat])

    const handleGroupActionSuccess = useCallback(() => {
        setSelectedGroupId(null)
    }, [])

    const {
        showUsers,
        setShowUsers,
        securityOpen,
        setSecurityOpen,
        isDesktop,
        showBundleSynced,
        showAutoUnlock,
        messagesRef,
        handleMessagesScroll,
    } = useChatLayout({
        activeConversationKey,
        hasMessages: messages.length > 0,
        messageCount: messages.length,
        latestMessageIsMine: messages[messages.length - 1]?.isMine ?? false,
        bundleSynced,
        autoUnlockAt,
        onReachBottom: handleReachBottom,
    })

    // Deep-link notification : /messages?user=<id> ouvre la conversation, puis
    // le paramètre est effacé en `replace` — l'uid ne survit ni dans la barre
    // d'adresse, ni dans l'historique, ni dans un lien recopié.
    useEffect(() => {
        const u = searchParams.get("user")
        if (!u) return
        /* eslint-disable react-hooks-extra/no-direct-set-state-in-use-effect -- sync d'un param d'URL externe vers la sélection */
        if (u !== currentUserId) {
            setSelectedRecipientId(u)
            setSelectedGroupId(null)
            setShowUsers(false)
        }
        /* eslint-enable @eslint-react/hooks-extra/no-direct-set-state-in-use-effect */
        setSearchParams({}, { replace: true })
    }, [searchParams, setSearchParams, currentUserId, setShowUsers])

    useEffect(() => {
        if (!selectedRecipientId) return
        // Sélection de soi-même invalide (resync de validation d'entité)
        // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
        if (selectedRecipientId === currentUserId) setSelectedRecipientId(null)
    }, [selectedRecipientId, currentUserId])

    useEffect(() => {
        if (selectedGroupId) void markGroupRead(selectedGroupId)
    }, [selectedGroupId, markGroupRead])

    useEffect(() => {
        if (!selectedGroupId) return
        if (
            !chatGroupsLoading &&
            !chatGroups.some((g) => g.id === selectedGroupId)
        ) {
            // Groupe disparu (supprimé, ou plus membre) : on referme
            // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
            setSelectedGroupId(null)
        }
    }, [chatGroups, chatGroupsLoading, selectedGroupId])

    const { securityPanel, groupMembersPanel } = buildChatHeaderPanels({
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
        allUsers: groups,
    })

    // Aussi quand déverrouillé : compte créé sans PIN, à migrer (usePinManager).
    if (needsPinSetup) {
        return (
            <ChatLockScreen>
                <PinSetupScreen
                    onSetup={setupPin}
                    setupError={setupError}
                    setupInProgress={setupInProgress}
                />
            </ChatLockScreen>
        )
    }

    if (locked && needsPassphrase) {
        return (
            <ChatLockScreen>
                <PinUnlockScreen
                    onUnlock={unlock}
                    unlocking={unlocking}
                    unlockError={unlockError}
                    remoteBundleAvailable={remoteBundleAvailable}
                    forceBundleResync={forceBundleResync}
                    purgeRemoteBundle={purgeRemoteBundle}
                    importFromQRCode={importFromQRCode}
                />
            </ChatLockScreen>
        )
    }

    return (
        <div className="relative flex h-[calc(100dvh-4rem)] max-h-[calc(100dvh-4rem)] min-h-0 overflow-hidden rounded-2xl border border-border bg-card shadow-surface">
            <ChatUsersSidebar
                showUsers={showUsers}
                setShowUsers={setShowUsers}
                groups={groups}
                usersLoading={usersLoading}
                unreadByUser={unreadByUser}
                activeConversations={activeConversations}
                selectedRecipientId={selectedRecipientId}
                setSelectedRecipientId={setSelectedRecipientId}
                chatGroups={chatGroups}
                chatGroupsLoading={chatGroupsLoading}
                selectedGroupId={selectedGroupId}
                setSelectedGroupId={setSelectedGroupId}
                onCreateGroup={createGroup}
            />

            <section className="flex min-h-0 flex-1 flex-col">
                <ChatHeader
                    selectedRecipientId={selectedRecipientId}
                    selectedGroupId={selectedGroupId}
                    selectedGroupName={selectedGroup?.name}
                    isGroupAdmin={isGroupAdmin}
                    isGroupMember={isGroupMember}
                    onUpdateGroup={updateGroup}
                    onDeleteGroup={deleteGroup}
                    onLeaveGroup={leaveGroup}
                    onGroupActionSuccess={handleGroupActionSuccess}
                    setShowUsers={setShowUsers}
                    showBundleSynced={showBundleSynced}
                    bundleSynced={bundleSynced}
                    securityPanel={securityPanel}
                    groupMembersPanel={groupMembersPanel}
                />

                <ChatAlerts
                    hasActiveConversation={hasActiveConversation}
                    error={error}
                    showAutoUnlock={showAutoUnlock}
                />

                {/* Le voile de dépôt est posé sur ce conteneur, PAS sur le
                    scroller : un enfant `absolute inset-0` d'un élément
                    `overflow-auto` se cale sur le haut du contenu et défile
                    avec lui — dans une conversation scrollée en bas (le cas
                    normal), il s'affichait hors de vue. */}
                <div className="relative flex-1 min-h-0" {...dropHandlers}>
                    {isDragActive && <ChatDropOverlay />}
                    <div
                        ref={messagesRef}
                        className="h-full overflow-auto px-4 py-3"
                        onScroll={handleMessagesScroll}
                        role="region"
                        aria-label="Messages"
                    >
                        {showLoadingIndicator ? (
                            <MessagesSkeleton />
                        ) : hasActiveConversation ? (
                            <MessageList
                                messages={messages}
                                currentUserId={currentUserId}
                                onDelete={deleteMessage}
                                onReply={setReplyTo}
                                hasMore={hasMore}
                                onLoadMore={loadMore}
                                scrollContainerRef={messagesRef}
                                typingUserIds={typingUserIds}
                                isGroup={isGroup}
                                senders={senders}
                                onRequestAttachment={
                                    activeChat.requestAttachment
                                }
                            />
                        ) : (
                            <ChatEmptyState
                                onShowConversations={() => setShowUsers(true)}
                            />
                        )}
                    </div>
                </div>

                {hasActiveConversation ? (
                    <div className="border-t border-border/60 px-4 py-3 pb-safe">
                        <MessageInput
                            ref={composerRef}
                            onSend={handleSend}
                            onSendFile={handleSendFile}
                            disabled={locked}
                            onTyping={onTypingStart}
                            replyTo={replyTo}
                            onCancelReply={() => setReplyTo(null)}
                        />
                    </div>
                ) : null}
            </section>
        </div>
    )
})

export const ChatView = memo(function ChatView({
    recipientId,
}: {
    recipientId?: string
}) {
    return (
        <SecurityStateProvider>
            <ChatViewContent recipientId={recipientId} />
        </SecurityStateProvider>
    )
})
