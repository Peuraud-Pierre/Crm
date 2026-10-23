import { Skeleton } from "@/shared/ui/atoms/skeleton"
import { cn } from "@/shared/lib/utils"
import { formatFileSize } from "../../utils/messageFormatting"
import { getMediaBoxStyle } from "./MessageMedia"

export type MessageAttachmentPendingProps = {
    fileName?: string | null
    fileSize?: number | null
    isImage: boolean
    /** Ratio connu (nouvelles images) — sinon cadre 4:3 par défaut. */
    aspectRatio?: number | null
    className?: string
}

/**
 * Attente d'une pièce jointe en cours de téléchargement/déchiffrement.
 *
 * Remplace le placeholder textuel que `core/crypto.ts` place dans le `body`
 * du message (« Chargement fichier... »), rendu jusqu'ici comme un message
 * ordinaire. L'état est déduit structurellement côté UI, ce qui évite de
 * dépendre d'une chaîne définie dans le module crypto.
 */
export function MessageAttachmentPending({
    fileName,
    fileSize,
    isImage,
    aspectRatio,
    className,
}: MessageAttachmentPendingProps) {
    const sizeLabel = formatFileSize(fileSize)

    if (isImage) {
        return (
            <Skeleton
                // Exactement la boîte que le média occupera : le squelette et
                // l'image ont la même taille, donc rien ne bouge à l'arrivée.
                style={getMediaBoxStyle(aspectRatio)}
                className={cn("rounded-[inherit]", className)}
                role="status"
                aria-busy="true"
                aria-label={
                    fileName
                        ? `Chargement de ${fileName}`
                        : "Chargement du média"
                }
            />
        )
    }

    return (
        <div
            className={cn("flex items-center gap-3", className)}
            role="status"
            aria-busy="true"
            aria-label={
                fileName
                    ? `Chargement du fichier ${fileName}`
                    : "Chargement du fichier"
            }
        >
            <Skeleton className="size-10 shrink-0 rounded-xl" />
            <div className="flex min-w-0 flex-col gap-1.5">
                {/* Le nom et la taille sont déjà connus (ils viennent de la
                    ligne, pas du fichier) : les afficher évite un squelette
                    qui cacherait une information disponible. */}
                <span className="max-w-40 truncate text-sm font-medium">
                    {fileName ?? "Fichier"}
                </span>
                <span className="text-2xs opacity-70">
                    {sizeLabel ? `${sizeLabel} · ` : ""}Déchiffrement…
                </span>
            </div>
        </div>
    )
}
