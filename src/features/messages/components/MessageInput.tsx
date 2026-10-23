import { Smile, Plus, Send, X, Reply, Loader2 } from "lucide-react"
import { useImperativeHandle } from "react"
import type { CryptedMessage } from "../hooks/useCryptedChat"
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from "@/shared/ui/atoms/drawer"
import { useMessageComposer } from "../hooks/useMessageComposer"
import { ComposerAttachments } from "./messages/ComposerAttachments"

export type MessageInputHandle = {
    enqueueFiles: (files: File[]) => void
}

export function MessageInput({
    onSend,
    onSendFile,
    disabled,
    onTyping,
    replyTo,
    onCancelReply,
    ref,
}: {
    onSend: (text: string) => Promise<void> | void
    onSendFile?: (file: File) => Promise<void> | void
    disabled?: boolean
    onTyping?: () => void
    replyTo?: CryptedMessage | null
    onCancelReply?: () => void
    ref?: React.Ref<MessageInputHandle>
}) {
    const {
        text,
        setText,
        isEmojiOpen,
        setIsEmojiOpen,
        emojiList,
        fileInputRef,
        textareaRef,
        stagedFiles,
        uploadStatus,
        isSending,
        canSend,
        enqueueFiles,
        removeFile,
        clearFiles,
        handleSend,
        handleKeyDown,
        handlePaste,
        insertEmoji,
        handleFileChange,
        openFilePicker,
    } = useMessageComposer({ onSend, onSendFile })

    useImperativeHandle(
        ref,
        () => ({ enqueueFiles: (files) => void enqueueFiles(files) }),
        [enqueueFiles]
    )

    return (
        <div className="relative">
            {replyTo && (
                <div className="mb-2 flex items-center gap-2 rounded-lg bg-muted px-3 py-1.5 text-xs">
                    <Reply className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="flex-1 truncate text-muted-foreground">
                        {(replyTo.body || replyTo.file_name || "Fichier").slice(
                            0,
                            80
                        )}
                    </span>
                    <button
                        type="button"
                        onClick={onCancelReply}
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                        aria-label="Annuler la réponse"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>
            )}
            <ComposerAttachments
                files={stagedFiles}
                onRemove={removeFile}
                onClear={clearFiles}
                uploadStatus={uploadStatus}
            />
            <div className="flex items-end gap-2">
                {/* Emoji — desktop */}
                <div className="relative hidden sm:block">
                    <button
                        type="button"
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0 disabled:opacity-50"
                        onClick={() => setIsEmojiOpen((prev) => !prev)}
                        disabled={disabled}
                        title="Ajouter un emoji"
                        aria-haspopup="dialog"
                        aria-expanded={isEmojiOpen}
                    >
                        <Smile className="h-4 w-4" />
                    </button>
                    {isEmojiOpen && (
                        <div
                            className="absolute bottom-11 left-0 z-20 w-52 rounded-xl border border-border bg-popover p-2 shadow-lg"
                            role="dialog"
                            aria-label="Sélecteur d'emoji"
                        >
                            <div className="grid grid-cols-6 gap-1">
                                {emojiList.map((emoji) => (
                                    <button
                                        key={emoji}
                                        type="button"
                                        onClick={() => insertEmoji(emoji)}
                                        className="h-8 w-8 rounded-lg text-lg hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0"
                                        aria-label={`Emoji ${emoji}`}
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Emoji — mobile (drawer) */}
                <Drawer>
                    <DrawerTrigger asChild>
                        <button
                            type="button"
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0 disabled:opacity-50 sm:hidden"
                            disabled={disabled}
                            title="Ajouter un emoji"
                            onClick={() => setIsEmojiOpen(false)}
                            aria-haspopup="dialog"
                        >
                            <Smile className="h-4 w-4" />
                        </button>
                    </DrawerTrigger>
                    <DrawerContent className="rounded-t-2xl border-border bg-background">
                        <DrawerHeader className="pb-0">
                            <DrawerTitle className="text-sm">
                                Emojis
                            </DrawerTitle>
                        </DrawerHeader>
                        <div className="px-4 pb-6 pt-2">
                            <div className="grid grid-cols-8 gap-2">
                                {emojiList.map((emoji) => (
                                    <DrawerClose asChild key={emoji}>
                                        <button
                                            type="button"
                                            onClick={() => insertEmoji(emoji)}
                                            className="h-9 w-9 rounded-xl text-lg hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0"
                                            aria-label={`Emoji ${emoji}`}
                                        >
                                            {emoji}
                                        </button>
                                    </DrawerClose>
                                ))}
                            </div>
                        </div>
                    </DrawerContent>
                </Drawer>

                {/* + Fichier */}
                <button
                    type="button"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0 disabled:opacity-50"
                    onClick={openFilePicker}
                    disabled={disabled || !onSendFile}
                    title="Ajouter un fichier"
                >
                    <Plus className="h-4 w-4" />
                </button>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept="*/*"
                    multiple
                    className="hidden"
                    onChange={handleFileChange}
                    disabled={disabled}
                />

                {/* Textarea */}
                <textarea
                    ref={textareaRef}
                    className="min-h-9 flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none disabled:opacity-50"
                    placeholder="Écrire un message chiffré..."
                    value={text}
                    onChange={(event) => {
                        setText(event.target.value)
                        onTyping?.()
                    }}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    disabled={disabled}
                    aria-label="Message"
                    rows={text.split("\n").length || 1}
                />

                {/* Envoyer */}
                <button
                    type="button"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0 disabled:opacity-50"
                    onClick={handleSend}
                    disabled={disabled || !canSend}
                    title="Envoyer"
                    aria-busy={isSending}
                >
                    {isSending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Send className="h-4 w-4" />
                    )}
                </button>
            </div>
        </div>
    )
}
