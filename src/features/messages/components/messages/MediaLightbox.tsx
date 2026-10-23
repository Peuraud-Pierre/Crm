import { useCallback, useEffect } from "react"
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react"
import { getMediaKind } from "../../utils/messageMedia"

export type LightboxItem = {
    url: string
    name?: string | null
    mime?: string | null
}

export type MediaLightboxProps = {
    items: LightboxItem[]
    index: number
    onIndexChange: (index: number) => void
    onClose: () => void
}

/**
 * Visionneuse plein écran, navigable au clavier et aux flèches.
 *
 * Remplace `ImageZoomDialog`, qui n'affichait qu'une image isolée : ouvrir une
 * photo d'un lot obligeait à fermer puis rouvrir pour voir la suivante.
 */
export function MediaLightbox({
    items,
    index,
    onIndexChange,
    onClose,
}: MediaLightboxProps) {
    const count = items.length
    const current = items[index]

    const go = useCallback(
        (delta: number) => {
            if (count === 0) return
            // Navigation circulaire : au bout d'un lot, on revient au début.
            onIndexChange((index + delta + count) % count)
        },
        [count, index, onIndexChange]
    )

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose()
            if (event.key === "ArrowRight") go(1)
            if (event.key === "ArrowLeft") go(-1)
        }
        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [go, onClose])

    if (!current) return null

    const kind = getMediaKind(current.mime)

    return (
        <div
            // eslint-disable-next-line nokk-project/no-restricted-syntax -- scrim/overlay volontairement noir quel que soit le thème (design system §12.4)
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 p-4 animate-in fade-in duration-fast"
            role="dialog"
            aria-modal="true"
            aria-label={current.name ? `Aperçu ${current.name}` : "Aperçu"}
            onClick={onClose}
        >
            <div className="absolute right-3 top-3 flex gap-2">
                <a
                    href={current.url}
                    download={current.name ?? "fichier"}
                    onClick={(event) => event.stopPropagation()}
                    // eslint-disable-next-line nokk-project/no-restricted-syntax -- posé sur le scrim noir, indépendant du thème (§12.4)
                    className="rounded-full bg-white/15 p-2 text-white transition-colors duration-fast hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    aria-label="Télécharger"
                    title="Télécharger"
                >
                    <Download className="h-4 w-4" />
                </a>
                <button
                    type="button"
                    onClick={onClose}
                    // eslint-disable-next-line nokk-project/no-restricted-syntax -- posé sur le scrim noir, indépendant du thème (§12.4)
                    className="rounded-full bg-white/15 p-2 text-white transition-colors duration-fast hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    aria-label="Fermer"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>

            {count > 1 && (
                <>
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation()
                            go(-1)
                        }}
                        // eslint-disable-next-line nokk-project/no-restricted-syntax -- posé sur le scrim noir, indépendant du thème (§12.4)
                        className="absolute left-3 rounded-full bg-white/15 p-2 text-white transition-colors duration-fast hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                        aria-label="Média précédent"
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation()
                            go(1)
                        }}
                        // eslint-disable-next-line nokk-project/no-restricted-syntax -- posé sur le scrim noir, indépendant du thème (§12.4)
                        className="absolute right-3 top-1/2 rounded-full bg-white/15 p-2 text-white transition-colors duration-fast hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                        aria-label="Média suivant"
                    >
                        <ChevronRight className="h-5 w-5" />
                    </button>
                </>
            )}

            <div
                className="flex max-h-full max-w-full flex-col items-center gap-2"
                onClick={(event) => event.stopPropagation()}
            >
                {kind === "video" ? (
                    <video
                        key={current.url}
                        src={current.url}
                        controls
                        autoPlay
                        playsInline
                        className="max-h-[80vh] max-w-full rounded-lg"
                    >
                        <track kind="captions" />
                    </video>
                ) : (
                    <img
                        key={current.url}
                        src={current.url}
                        alt={current.name ?? "Aperçu"}
                        className="max-h-[80vh] max-w-full rounded-lg object-contain"
                    />
                )}

                <div className="flex items-center gap-2 text-xs">
                    {current.name ? (
                        // eslint-disable-next-line nokk-project/no-restricted-syntax -- posé sur le scrim noir, indépendant du thème (§12.4)
                        <span className="text-white/70">{current.name}</span>
                    ) : null}
                    {count > 1 && (
                        // eslint-disable-next-line nokk-project/no-restricted-syntax -- posé sur le scrim noir, indépendant du thème (§12.4)
                        <span className="tabular-nums text-white/50">
                            {index + 1} / {count}
                        </span>
                    )}
                </div>
            </div>
        </div>
    )
}
