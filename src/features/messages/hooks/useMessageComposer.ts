import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { compressImage } from "../utils/compressImage"

export type UseMessageComposerParams = {
    onSend: (text: string) => Promise<void> | void
    onSendFile?: (file: File) => Promise<void> | void
}

export type StagedFile = {
    /** Identifiant local, stable tant que le fichier reste dans le panier. */
    id: string
    file: File
    previewUrl: string | null
    /** `true` tant que la compression tourne en arrière-plan. */
    preparing: boolean
}

export type UploadStatus = {
    /** Nombre de fichiers déjà envoyés dans la salve en cours. */
    sent: number
    total: number
}

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

function formatBytes(bytes: number): string {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} Ko`
    return `${bytes} o`
}

const DEFAULT_EMOJIS = [
    "😀",
    "😁",
    "😅",
    "😂",
    "😍",
    "🥰",
    "😘",
    "😎",
    "🤔",
    "😮",
    "😢",
    "😭",
    "😡",
    "👍",
    "👏",
    "🙏",
    "🔥",
    "✨",
    "🎉",
    "✅",
    "❤️",
    "💬",
    "👀",
    "🚀",
]

export function useMessageComposer({
    onSend,
    onSendFile,
}: UseMessageComposerParams) {
    const [text, setText] = useState("")
    const [isEmojiOpen, setIsEmojiOpen] = useState(false)
    const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([])
    const [uploadStatus, setUploadStatus] = useState<UploadStatus | null>(null)
    const fileInputRef = useRef<HTMLInputElement | null>(null)
    const textareaRef = useRef<HTMLTextAreaElement | null>(null)
    const previewUrlsRef = useRef<Set<string>>(new Set())
    const onSendFileRef = useRef(onSendFile)

    useEffect(() => {
        onSendFileRef.current = onSendFile
    }, [onSendFile])

    const emojiList = useMemo(() => DEFAULT_EMOJIS, [])

    const releasePreview = useCallback((url: string | null) => {
        if (!url) return
        URL.revokeObjectURL(url)
        previewUrlsRef.current.delete(url)
    }, [])

    useEffect(() => {
        const urls = previewUrlsRef.current
        return () => {
            for (const url of urls) URL.revokeObjectURL(url)
            urls.clear()
        }
    }, [])

    /**
     * Ajoute des fichiers au panier — sans les envoyer.
     *
     * La vignette apparaît **avant** la compression : `compressImage` était
     * auparavant attendu en amont de tout retour visuel, ce qui figeait
     * l'interface plusieurs secondes sur une grosse photo.
     */
    const enqueueFiles = useCallback(
        async (files: File[]) => {
            if (!onSendFileRef.current || files.length === 0) return

            const staged: StagedFile[] = files.map((file) => {
                const previewUrl = file.type.startsWith("image/")
                    ? URL.createObjectURL(file)
                    : null
                if (previewUrl) previewUrlsRef.current.add(previewUrl)
                return {
                    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
                    file,
                    previewUrl,
                    preparing: true,
                }
            })
            setStagedFiles((prev) => [...prev, ...staged])

            await Promise.all(
                staged.map(async (entry) => {
                    const prepared = await compressImage(entry.file).catch(
                        () => entry.file
                    )
                    if (prepared.size > MAX_UPLOAD_BYTES) {
                        toast.error(
                            `Fichier trop volumineux : ${prepared.name}`,
                            {
                                description: `Taille maximale ${formatBytes(
                                    MAX_UPLOAD_BYTES
                                )} (reçu ${formatBytes(prepared.size)}).`,
                            }
                        )
                        releasePreview(entry.previewUrl)
                        setStagedFiles((prev) =>
                            prev.filter((item) => item.id !== entry.id)
                        )
                        return
                    }
                    setStagedFiles((prev) =>
                        prev.map((item) =>
                            item.id === entry.id
                                ? { ...item, file: prepared, preparing: false }
                                : item
                        )
                    )
                })
            )
        },
        [releasePreview]
    )

    const removeFile = useCallback(
        (id: string) => {
            setStagedFiles((prev) => {
                const target = prev.find((item) => item.id === id)
                releasePreview(target?.previewUrl ?? null)
                return prev.filter((item) => item.id !== id)
            })
        },
        [releasePreview]
    )

    const clearFiles = useCallback(() => {
        setStagedFiles((prev) => {
            for (const item of prev) releasePreview(item.previewUrl)
            return []
        })
    }, [releasePreview])

    /**
     * Envoie les pièces jointes puis le texte, en une action explicite.
     *
     * Auparavant tout fichier partait dès sa sélection : aucune validation,
     * aucune annulation possible, et la seule sortie était de supprimer le
     * message après coup.
     */
    const handleSend = useCallback(async () => {
        const trimmed = text.trim()
        const filesToSend = stagedFiles.filter((item) => !item.preparing)
        if (!trimmed && filesToSend.length === 0) return

        const sendFile = onSendFileRef.current
        if (sendFile && filesToSend.length > 0) {
            setUploadStatus({ sent: 0, total: filesToSend.length })
            for (const [index, entry] of filesToSend.entries()) {
                try {
                    await sendFile(entry.file)
                    removeFile(entry.id)
                } catch (err) {
                    const description =
                        err instanceof Error && err.message
                            ? err.message
                            : "Réessayez."
                    toast.error(`Échec de l'envoi de « ${entry.file.name} »`, {
                        description,
                    })
                    // Le fichier reste dans le panier : l'utilisateur peut
                    // réessayer sans le resélectionner.
                }
                setUploadStatus({ sent: index + 1, total: filesToSend.length })
            }
            setUploadStatus(null)
        }

        if (!trimmed) {
            setIsEmojiOpen(false)
            return
        }

        try {
            await onSend(trimmed)
            setText("")
            setIsEmojiOpen(false)
        } catch (err) {
            const description =
                err instanceof Error && err.message ? err.message : "Réessayez."
            toast.error("Échec de l'envoi du message", { description })
        }
    }, [onSend, removeFile, stagedFiles, text])

    const handleKeyDown = useCallback(
        async (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (event.key !== "Enter" || event.shiftKey) return
            event.preventDefault()
            await handleSend()
        },
        [handleSend]
    )

    const insertEmoji = useCallback(
        (emoji: string) => {
            const element = textareaRef.current
            if (!element) {
                setText((prev) => `${prev}${emoji}`)
                setIsEmojiOpen(false)
                return
            }
            const start = element.selectionStart ?? text.length
            const end = element.selectionEnd ?? text.length
            const next = `${text.slice(0, start)}${emoji}${text.slice(end)}`
            setText(next)
            requestAnimationFrame(() => {
                const cursor = start + emoji.length
                element.focus()
                element.setSelectionRange(cursor, cursor)
            })
            setIsEmojiOpen(false)
        },
        [text]
    )

    const handleFileChange = useCallback(
        (event: React.ChangeEvent<HTMLInputElement>) => {
            const files = event.target.files
                ? Array.from(event.target.files)
                : []
            if (event.target) event.target.value = ""
            void enqueueFiles(files)
        },
        [enqueueFiles]
    )

    const openFilePicker = useCallback(() => {
        fileInputRef.current?.click()
    }, [])

    const handlePaste = useCallback(
        (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
            const items = event.clipboardData?.items
            if (!items || !onSendFileRef.current) return
            const images: File[] = []
            for (const item of items) {
                if (item.type.startsWith("image/")) {
                    const file = item.getAsFile()
                    if (file) images.push(file)
                }
            }
            if (images.length === 0) return
            event.preventDefault()
            void enqueueFiles(images)
        },
        [enqueueFiles]
    )

    const isSending = uploadStatus !== null
    // Le bouton ne réagissait qu'au texte : un envoi de fichier seul était
    // impossible une fois le panier introduit.
    const canSend =
        !isSending &&
        (text.trim().length > 0 || stagedFiles.some((item) => !item.preparing))

    return {
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
    }
}
