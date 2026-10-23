import type { UploadProgress } from "@/features/drive/utils/ChunkedUploader"
import { formatBytes } from "@/features/drive/utils/fileDisplay"

/**
 * Progression de l'envoi en cours. Distingue l'envoi direct de l'envoi par
 * chunks, parce que la différence de durée est visible pour l'utilisateur.
 */
export default function UploadProgressBar({
    progress,
}: {
    progress: UploadProgress
}) {
    const chunked = progress.uploadedChunks > 1

    return (
        <div className="mb-4 space-y-2 rounded-lg border bg-muted/30 p-4">
            <div className="flex justify-between text-sm">
                <span className="font-medium">
                    {progress.percent < 100
                        ? "Envoi en cours…"
                        : "Finalisation…"}
                </span>
                <span className="text-muted-foreground">
                    {progress.percent}%
                </span>
            </div>

            <div
                className="h-2 w-full overflow-hidden rounded-full bg-secondary"
                role="progressbar"
                aria-valuenow={progress.percent}
                aria-valuemin={0}
                aria-valuemax={100}
            >
                <div
                    className="h-full bg-primary transition-[width] duration-slow ease-out"
                    style={{ width: `${progress.percent}%` }}
                />
            </div>

            <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                    {chunked
                        ? `Morceau ${progress.uploadedChunks}/${progress.totalChunks}`
                        : "Envoi direct"}
                </span>
                <span>
                    {formatBytes(progress.uploadedBytes) ?? "0 o"} /{" "}
                    {formatBytes(progress.totalBytes) ?? "—"}
                </span>
            </div>
        </div>
    )
}
