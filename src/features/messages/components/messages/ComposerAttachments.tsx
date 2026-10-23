import { Loader2, Paperclip, X } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { staggerStyle } from "@/shared/lib/motion"
import { formatFileSize } from "../../utils/messageFormatting"
import type { StagedFile, UploadStatus } from "../../hooks/useMessageComposer"

export type ComposerAttachmentsProps = {
    files: StagedFile[]
    onRemove: (id: string) => void
    onClear: () => void
    uploadStatus: UploadStatus | null
}

/**
 * Panier de pièces jointes en attente d'envoi.
 *
 * Les fichiers partaient jusqu'ici dès leur sélection : ni aperçu, ni retrait,
 * ni message d'accompagnement. Cette bande rend l'envoi explicite.
 */
export function ComposerAttachments({
    files,
    onRemove,
    onClear,
    uploadStatus,
}: ComposerAttachmentsProps) {
    if (files.length === 0) return null

    const isSending = uploadStatus !== null

    return (
        <div className="mb-2 rounded-xl border border-border bg-muted/40 p-2">
            <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
                <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                    {files.length === 1
                        ? "1 pièce jointe"
                        : `${files.length} pièces jointes`}
                </span>
                {isSending ? (
                    <span
                        className="text-2xs tabular-nums text-muted-foreground"
                        role="status"
                        aria-live="polite"
                    >
                        Envoi {uploadStatus.sent}/{uploadStatus.total}…
                    </span>
                ) : (
                    <button
                        type="button"
                        onClick={onClear}
                        className="rounded text-2xs text-muted-foreground transition-colors duration-fast hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        Tout retirer
                    </button>
                )}
            </div>

            <ul className="flex flex-wrap gap-2">
                {files.map((entry, index) => (
                    <li
                        key={entry.id}
                        style={staggerStyle(index, { step: 40, cap: 200 })}
                        className="group/staged relative flex animate-in fade-in zoom-in-95 fill-mode-backwards items-center gap-2 rounded-lg border border-border bg-background py-1 pl-1 pr-2 duration-base ease-overshoot"
                    >
                        {entry.previewUrl ? (
                            <img
                                src={entry.previewUrl}
                                alt=""
                                className="size-9 shrink-0 rounded-md object-cover"
                            />
                        ) : (
                            <span
                                className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
                                aria-hidden
                            >
                                <Paperclip className="h-4 w-4" />
                            </span>
                        )}

                        <span className="flex min-w-0 flex-col">
                            <span className="max-w-36 truncate text-xs font-medium text-foreground">
                                {entry.file.name}
                            </span>
                            <span className="text-3xs text-muted-foreground">
                                {entry.preparing
                                    ? "Préparation…"
                                    : formatFileSize(entry.file.size)}
                            </span>
                        </span>

                        {entry.preparing ? (
                            <Loader2
                                className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground"
                                aria-hidden
                            />
                        ) : (
                            <button
                                type="button"
                                onClick={() => onRemove(entry.id)}
                                disabled={isSending}
                                className={cn(
                                    "shrink-0 rounded-full p-1 text-muted-foreground transition-colors duration-fast",
                                    "hover:bg-destructive/10 hover:text-destructive",
                                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                    "disabled:opacity-40"
                                )}
                                aria-label={`Retirer ${entry.file.name}`}
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    )
}
