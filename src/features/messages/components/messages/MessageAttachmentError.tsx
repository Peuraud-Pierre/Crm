import { AlertTriangle } from "lucide-react"

export type MessageAttachmentErrorProps = {
    message: string
    fileName?: string | null
}

export function MessageAttachmentError({
    message,
    fileName,
}: MessageAttachmentErrorProps) {
    return (
        <div className="flex items-start gap-2 rounded-md border border-dashed border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div className="flex min-w-0 flex-col gap-0.5">
                <span className="font-medium">{message}</span>
                {fileName ? (
                    <span className="truncate opacity-70">{fileName}</span>
                ) : null}
            </div>
        </div>
    )
}
