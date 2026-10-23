import { useShareCtx } from "@/features/drive/context/ShareProvider"
import { toast } from "sonner"
import { downloadFile } from "@/shared/lib/utils"
import {
    downloadName,
    fileIcon,
    formatBytes,
} from "@/features/drive/utils/fileDisplay"
import { isVideoUrl } from "@/shared/utils/media"
import { Download, Share2, Trash2 } from "lucide-react"
import { useEffect } from "react"

import { Button } from "@/shared/ui/atoms/button"
import {
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/shared/ui/atoms/dialog"
import PdfPreview from "./PdfPreview"
import Share from "./Share"
import StreamingVideo from "./StreamingVideo"
import type { DriveItem } from "../types"

export default function Preview({
    preview,
    previewDelete,
    onClose,
}: {
    preview: DriveItem
    previewDelete: (ids: string[]) => Promise<void>
    onClose: () => void
}) {
    const { setShareOpen, setItemIds, loadPermissions, loading } =
        useShareCtx()

    useEffect(() => {
        if (preview?.id) loadPermissions(preview.id)
    }, [preview?.id, loadPermissions])

    if (!preview) return null

    const mime = preview.mime?.toLowerCase()
    const isVideo =
        preview.type === "video" ||
        mime?.startsWith("video/") ||
        isVideoUrl(preview.url)
    // Le `!mime` couvre les entrées antérieures à la migration 005, qui ne
    // pouvaient être que des images ou des vidéos.
    const isImage =
        !isVideo && (preview.type === "image" || mime?.startsWith("image/") || !mime)
    // Le backend sert les PDF en Content-Disposition inline : le visualiseur
    // natif du navigateur les affiche donc dans une iframe.
    const isPdf = mime === "application/pdf"
    const Icon = fileIcon(preview)
    const size = formatBytes(preview.sizeBytes)

    const kindLabel = isVideo
        ? "vidéo"
        : isImage
          ? "image"
          : (mime ?? "fichier")

    return (
        <>
            <DialogContent
                className="
          max-w-[95vw] sm:max-w-5xl
          w-full
          flex
          flex-col
          items-center
          justify-start
          p-3 sm:p-4 md:p-6
          overflow-y-auto
          max-h-[95vh] sm:max-h-[90vh]
          gap-0
        "
            >
                {/* ✅ Header avec description pour accessibilité */}
                <DialogHeader className="text-center w-full flex-shrink-0 pr-8">
                    <DialogTitle className="text-base sm:text-lg md:text-xl font-semibold truncate px-2">
                        {preview.title}
                    </DialogTitle>
                    <p
                        id="dialog-description"
                        className="text-xs sm:text-sm text-muted-foreground mt-1"
                    >
                        Aperçu du fichier — {kindLabel}
                    </p>
                </DialogHeader>

                {/* ✅ Conteneur média responsive */}
                <div
                    className="
            relative
            w-full
            flex
            justify-center
            items-center
            overflow-hidden
            max-h-[50vh] sm:max-h-[60vh] md:max-h-[70vh]
            my-2 sm:my-4
            flex-1
          "
                >
                    {isVideo ? (
                        <StreamingVideo
                            src={preview.url}
                            // eslint-disable-next-line nokk-project/no-restricted-syntax -- couleur de donnée métier / rendu canvas : non tokenisable (design system §12.4)
                            className="
                w-full
                h-full
                max-h-[50vh] sm:max-h-[60vh] md:max-h-[70vh]
                max-w-full
                rounded-lg sm:rounded-2xl
                object-contain
                bg-black
                shadow
              "
                        />
                    ) : isImage ? (
                        <img
                            src={preview.url}
                            alt={preview.title}
                            className="
                max-h-[50vh] sm:max-h-[60vh] md:max-h-[70vh]
                max-w-full
                rounded-lg sm:rounded-2xl
                object-contain
                transition-transform
                duration-slow
                hover:scale-[1.02]
                shadow
              "
                        />
                    ) : isPdf ? (
                        <PdfPreview
                            url={preview.url}
                            title={preview.title}
                            sizeBytes={preview.sizeBytes}
                            className="
                h-[50vh] sm:h-[60vh] md:h-[70vh]
                w-full
                rounded-lg sm:rounded-2xl
                border-0
                shadow
              "
                        />
                    ) : (
                        // Aucun aperçu possible pour ce type : on décrit le
                        // fichier, le footer porte déjà l'action Télécharger.
                        <div className="flex w-full flex-col items-center justify-center gap-3 rounded-lg bg-muted/40 py-12 sm:rounded-2xl">
                            <Icon
                                className="h-16 w-16 text-muted-foreground"
                                aria-hidden="true"
                            />
                            <p className="text-sm text-muted-foreground">
                                Aperçu indisponible pour ce type de fichier
                                {size ? ` — ${size}` : ""}
                            </p>
                        </div>
                    )}
                </div>

                {/* ✅ Footer responsive avec boutons adaptés mobile */}
                {/* flex-row explicite : DialogFooter est flex-col-reverse par défaut,
                    sans quoi flex-wrap empile les boutons en colonnes étroites.
                    self-stretch + marges négatives : la bordure et l'arrondi rejoignent
                    les bords du dialog au lieu de s'arrêter avant. */}
                <DialogFooter
                    className="
            flex-row
            gap-2 sm:gap-3
            flex-wrap
            justify-center
            border-t
            pt-2 sm:pt-3
            mt-auto
            bg-card/70
            backdrop-blur
            rounded-b-lg sm:rounded-b-2xl
            sticky
            bottom-0
            z-10
            self-stretch
            -mx-3 px-3 -mb-3 pb-3
            sm:-mx-4 sm:px-4 sm:-mb-4 sm:pb-4
            md:-mx-6 md:px-6 md:-mb-6 md:pb-6
            flex-shrink-0
          "
                >
                    <Button
                        variant="destructive"
                        className="h-10 flex-1 gap-2 text-sm sm:h-9 sm:flex-none"
                        size="sm"
                        onClick={async () => {
                            try {
                                await previewDelete([preview.id])
                                onClose() // ✅ ferme la preview après suppression
                            } catch (err) {
                                console.error("Erreur de suppression :", err)
                            }
                        }}
                    >
                        <Trash2 className="h-4 w-4 shrink-0" />
                        Supprimer
                    </Button>

                    <Button
                        variant="outline"
                        className="h-10 flex-1 gap-2 text-sm sm:h-9 sm:flex-none"
                        size="sm"
                        onClick={() =>
                            downloadFile(
                                preview.url,
                                downloadName(preview)
                            ).catch((err) =>
                                toast.error("Téléchargement impossible", {
                                    description:
                                        (err instanceof Error
                                            ? err.message
                                            : undefined) ??
                                        "Le fichier n'a pas pu être récupéré.",
                                })
                            )
                        }
                    >
                        <Download className="h-4 w-4 shrink-0" />
                        Télécharger
                    </Button>

                    {/* Seul le propriétaire décide de qui a accès : sur un
                        élément reçu en partage, le backend refuse la demande
                        (403 sur /permissions), et le tiroir s'ouvrait pour
                        afficher une erreur. Même règle que la Toolbar. */}
                    {preview.owner === "perso" && (
                        <Button
                            className="h-10 flex-1 gap-2 text-sm sm:h-9 sm:flex-none"
                            size="sm"
                            onClick={() => {
                                setItemIds([preview.id])
                                setShareOpen(true)
                            }}
                            disabled={loading}
                        >
                            <Share2 className="h-4 w-4 shrink-0" />
                            Partager
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>

            <Share />
        </>
    )
}
