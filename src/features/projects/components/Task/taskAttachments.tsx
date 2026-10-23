import { useRef, useState, type ReactNode } from "react"
import { Download, Loader2, Paperclip, Trash2 } from "lucide-react"

import { formatBytes } from "@/features/drive"
import { ConfirmDialog } from "@/features/projects/components/utils/confirmDialog"
import { useTaskAttachments } from "@/features/projects/hooks/data/useTaskAttachments"
import { useProjectListContext } from "@/features/projects/hooks/context/projectListContext"
import { Button } from "@/shared/ui/atoms/button"
import { Label } from "@/shared/ui/atoms/label"
import type {
    ProjectTaskAttachment,
    ProjectTaskAttachmentSummary,
} from "@/features/projects/types"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/atoms/tooltip"

export function TaskAttachments({
    taskId,
    editable,
}: {
    taskId: string
    editable: boolean
}) {
    // Recharge les tableaux : le compteur de la carte vient de leurs données.
    const { refresh } = useProjectListContext()
    const { attachments, loading, loadError, uploading, upload, remove, download } =
        useTaskAttachments(taskId, refresh)
    const [toDelete, setToDelete] = useState<ProjectTaskAttachment | null>(null)

    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">
                    Pièces jointes
                    {attachments.length > 0 && ` (${attachments.length})`}
                </Label>
                {editable && (
                    <AttachmentPicker busy={uploading} onPick={(files) => void upload(files)} />
                )}
            </div>

            {loading ? (
                <p className="text-xs text-muted-foreground">Chargement…</p>
            ) : loadError ? (
                <p className="text-xs text-destructive">
                    Impossible de charger les pièces jointes
                </p>
            ) : attachments.length === 0 ? (
                <p className="text-xs text-muted-foreground">Aucune pièce jointe</p>
            ) : (
                <ul className="divide-y rounded-md border">
                    {attachments.map((a) => (
                        <AttachmentRow
                            key={a.id}
                            name={a.file_name}
                            sizeBytes={a.size_bytes}
                            onOpen={() => void download(a)}
                        >
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                aria-label={`Télécharger ${a.file_name}`}
                                onClick={() => void download(a)}
                            >
                                <Download className="h-3.5 w-3.5" />
                            </Button>
                            {editable && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive"
                                    aria-label={`Supprimer ${a.file_name}`}
                                    onClick={() => setToDelete(a)}
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                            )}
                        </AttachmentRow>
                    ))}
                </ul>
            )}

            <ConfirmDialog
                open={toDelete !== null}
                onOpenChange={(open) => !open && setToDelete(null)}
                title="Supprimer la pièce jointe ?"
                description={`« ${toDelete?.file_name ?? ""} » sera définitivement supprimé.`}
                confirmLabel="Supprimer"
                onConfirm={() => {
                    if (toDelete) void remove(toDelete)
                    setToDelete(null)
                }}
            />
        </div>
    )
}

/** Bouton « Joindre » : ouvre le sélecteur natif, plusieurs fichiers possibles. */
export function AttachmentPicker({
    onPick,
    busy = false,
}: {
    onPick: (files: File[]) => void
    busy?: boolean
}) {
    const inputRef = useRef<HTMLInputElement>(null)
    return (
        <>
            <input
                ref={inputRef}
                type="file"
                multiple
                hidden
                onChange={(e) => {
                    const files = Array.from(e.target.files ?? [])
                    if (files.length) onPick(files)
                    // Permet de rechoisir le même fichier juste après.
                    e.target.value = ""
                }}
            />
            <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
            >
                {busy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                    <Paperclip className="h-3.5 w-3.5" />
                )}
                Joindre
            </Button>
        </>
    )
}

/** Ligne de fichier ; les actions passent en children. */
export function AttachmentRow({
    name,
    sizeBytes,
    onOpen,
    children,
}: {
    name: string
    sizeBytes: number
    onOpen?: () => void
    children?: ReactNode
}) {
    return (
        <li className="flex items-center gap-2 px-3 py-2">
            <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            {onOpen ? (
                <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-left text-sm hover:underline"
                    title={name}
                    onClick={onOpen}
                >
                    {name}
                </button>
            ) : (
                <span className="min-w-0 flex-1 truncate text-sm" title={name}>
                    {name}
                </span>
            )}
            <span className="shrink-0 text-xs text-muted-foreground">
                {formatBytes(sizeBytes)}
            </span>
            {children}
        </li>
    )
}

/** Trombone + nombre sur la carte ; le survol liste noms et tailles. */
export function AttachmentIndicator({
    attachments = [],
}: {
    attachments?: ProjectTaskAttachmentSummary[]
}) {
    if (attachments.length === 0) return null
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span
                    className="flex items-center gap-0.5"
                    aria-label={`${attachments.length} pièce(s) jointe(s)`}
                >
                    <Paperclip className="h-3 w-3" />
                    {attachments.length}
                </span>
            </TooltipTrigger>
            <TooltipContent side="bottom">
                <ul className="space-y-0.5">
                    {attachments.map((a) => (
                        <li key={a.id} className="flex gap-2">
                            <span className="max-w-60 truncate">{a.file_name}</span>
                            <span className="shrink-0 opacity-70">
                                {formatBytes(a.size_bytes)}
                            </span>
                        </li>
                    ))}
                </ul>
            </TooltipContent>
        </Tooltip>
    )
}
