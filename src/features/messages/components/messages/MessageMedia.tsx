import type { CSSProperties, ReactNode } from "react"
import { Download, Maximize2, Play } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import type { MediaKind } from "../../utils/messageMedia"

/**
 * Boîte maximale d'un média dans le fil, en pixels.
 *
 * Un GIF de 800×450 occupait toute la largeur de la conversation. La vignette
 * garde son format d'origine mais tient dans cette boîte ; en dessous de cette
 * largeur d'écran, `max-w-full` reprend la main.
 */
const MAX_MEDIA_WIDTH = 320
const MAX_MEDIA_HEIGHT = 320

/**
 * Dimensions d'affichage : le média est réduit pour tenir dans la boîte, sans
 * jamais être agrandi ni déformé.
 *
 * Calculer la boîte plutôt que de poser `aspect-ratio` + `max-height` évite
 * les bandes vides : sur un portrait, la hauteur plafonnée laissait l'image
 * flotter au milieu de son cadre.
 */
export function getMediaBoxStyle(
    aspectRatio?: number | null
): CSSProperties | undefined {
    if (!aspectRatio || aspectRatio <= 0) {
        // Dimensions inconnues (messages antérieurs) : on borne sans réserver,
        // le navigateur ajuste à la taille intrinsèque du média.
        return { maxWidth: MAX_MEDIA_WIDTH, maxHeight: MAX_MEDIA_HEIGHT }
    }

    // On part de la largeur maximale, puis on retombe sur la hauteur si c'est
    // elle qui contraint — un portrait sort sinon de la boîte.
    let width = MAX_MEDIA_WIDTH
    let height = width / aspectRatio
    if (height > MAX_MEDIA_HEIGHT) {
        height = MAX_MEDIA_HEIGHT
        width = height * aspectRatio
    }
    return { width: Math.round(width), height: Math.round(height), maxWidth: "100%" }
}

export type MessageMediaProps = {
    kind: MediaKind
    url: string
    name?: string | null
    mime?: string | null
    /** Ratio connu (`meta.width`/`height`) — sinon boîte par défaut. */
    aspectRatio?: number | null
    /** Ouvre la visionneuse. Absent pour l'audio, qui se lit sur place. */
    onOpen?: () => void
    /** Vignette de mosaïque : cadre carré, pas de coins ni d'actions propres. */
    inAlbum?: boolean
    /** Heure du message, incrustée sur le média faute de bandeau sous la bulle. */
    overlay?: ReactNode
    className?: string
}

/**
 * Rendu unifié des pièces jointes lisibles par le navigateur.
 *
 * Avant : seules les images passaient par un rendu visuel (`image_url`), tout
 * le reste tombait dans la ligne de téléchargement — une vidéo, un GIF et un
 * JPEG s'affichaient donc de trois façons différentes. La famille est
 * désormais déterminée en un seul endroit (`getMediaKind`), et les formats que
 * le navigateur ne sait pas rendre retombent explicitement sur le fichier.
 */
export function MessageMedia({
    kind,
    url,
    name,
    mime,
    aspectRatio,
    onOpen,
    inAlbum,
    overlay,
    className,
}: MessageMediaProps) {
    if (kind === "audio") {
        return (
            <div
                className={cn(
                    "flex min-w-56 max-w-72 flex-col gap-1.5",
                    className
                )}
            >
                <span className="truncate text-xs font-medium">
                    {name ?? "Audio"}
                </span>
                {/* Lecteur natif : contrôles, clavier et vitesse gérés par le
                    navigateur, et aucune dépendance ajoutée. */}
                <audio src={url} controls preload="metadata" className="w-full">
                    <track kind="captions" />
                </audio>
            </div>
        )
    }

    const boxStyle = inAlbum ? undefined : getMediaBoxStyle(aspectRatio)
    const fitClass = inAlbum
        ? "h-full w-full object-cover"
        : "h-full w-full object-contain"

    const media =
        kind === "video" ? (
            <video
                src={url}
                // `metadata` : la première image et la durée suffisent à
                // dessiner la vignette, sans télécharger la vidéo entière.
                preload="metadata"
                controls={!inAlbum}
                playsInline
                muted={inAlbum}
                className={cn("bg-muted", fitClass)}
            >
                <track kind="captions" />
            </video>
        ) : (
            <img
                src={url}
                alt={name ?? "Pièce jointe"}
                loading="lazy"
                decoding="async"
                className={cn("bg-muted", fitClass)}
            />
        )

    // En mosaïque, la tuile parente porte le clic et les actions.
    if (inAlbum) {
        return (
            <div className={cn("relative h-full w-full", className)}>
                {media}
                {kind === "video" && (
                    <span
                        className="pointer-events-none absolute inset-0 flex items-center justify-center"
                        aria-hidden
                    >
                        <span className="flex size-9 items-center justify-center rounded-full bg-background/80 text-foreground shadow-surface backdrop-blur-sm">
                            <Play className="h-4 w-4" />
                        </span>
                    </span>
                )}
            </div>
        )
    }

    return (
        <div
            className={cn(
                "group/media relative block overflow-hidden rounded-[inherit]",
                className
            )}
            style={boxStyle}
        >
            {kind === "video" ? (
                media
            ) : (
                <button
                    type="button"
                    className="block h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    onClick={onOpen}
                    aria-label={name ? `Agrandir ${name}` : "Agrandir l'image"}
                >
                    {media}
                </button>
            )}

            <div className="pointer-events-none absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity duration-fast group-hover/media:opacity-100 group-focus-within/media:opacity-100">
                <a
                    href={url}
                    download={name ?? "fichier"}
                    onClick={(event) => event.stopPropagation()}
                    className="pointer-events-auto rounded-full bg-background/85 p-1.5 text-foreground shadow-surface backdrop-blur-sm transition-colors duration-fast hover:bg-background focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={name ? `Télécharger ${name}` : "Télécharger"}
                    title="Télécharger"
                >
                    <Download className="h-3.5 w-3.5" />
                </a>
                {kind === "image" && (
                    <span
                        className="rounded-full bg-background/85 p-1.5 text-foreground shadow-surface backdrop-blur-sm"
                        aria-hidden
                    >
                        <Maximize2 className="h-3.5 w-3.5" />
                    </span>
                )}
            </div>

            {overlay ? (
                // Incrusté en bas à droite : la bulle média n'a plus de
                // bandeau où poser l'heure.
                <div
                    className={cn(
                        "pointer-events-none absolute bottom-1 right-1 rounded-full px-1.5 py-0.5",
                        // eslint-disable-next-line nokk-project/no-restricted-syntax -- posé sur un média quelconque, contraste indépendant du thème (§12.4)
                        "bg-black/45 text-white backdrop-blur-[2px]",
                        // Les contrôles natifs de la vidéo occupent le bas.
                        kind === "video" && "bottom-auto top-1 right-auto left-1"
                    )}
                >
                    {overlay}
                </div>
            ) : null}

            {/* Le MIME reste utile au diagnostic quand un format exotique
                arrive sans se rendre correctement. */}
            <span className="sr-only">{mime}</span>
        </div>
    )
}
