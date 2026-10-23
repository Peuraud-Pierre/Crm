import { useEffect, useRef, useState } from "react"
import { Loader2 } from "lucide-react"

interface StreamingVideoProps {
    src: string
    className?: string
}

/**
 * Composant vidéo optimisé pour le streaming par chunks
 * - Utilise les HTTP Range Requests natifs
 * - Signale un lien expiré à l'utilisateur (pas de rafraîchissement auto)
 * - Précharge uniquement les métadonnées pour économiser la bande passante
 * - Affiche un indicateur de chargement visuel pendant le streaming
 */
export default function StreamingVideo({
    src,
    className = "",
}: StreamingVideoProps) {
    const videoRef = useRef<HTMLVideoElement>(null)
    const [error, setError] = useState<string | null>(null)
    const [videoSrc, setVideoSrc] = useState(src)
    const [isLoading, setIsLoading] = useState(true)
    const [loadingProgress, setLoadingProgress] = useState(0)

    useEffect(() => {
        // Resync de l'état local sur changement de la prop `src` (nouvelle vidéo)
        /* eslint-disable react-hooks-extra/no-direct-set-state-in-use-effect */
        setVideoSrc(src)
        setError(null)
        setIsLoading(true)
        setLoadingProgress(0)
        /* eslint-enable @eslint-react/hooks-extra/no-direct-set-state-in-use-effect */
    }, [src])

    const handleError = () => {
        const video = videoRef.current
        if (!video) return

        // Pas de rafraîchissement automatique du jeton : la cause est traitée
        // côté serveur, où le cache ne ressert plus de lien proche de son
        // échéance. Il reste à l'utilisateur à recharger si la page est
        // restée ouverte au-delà de la durée de vie du lien.
        const errorCode = video.error?.code
        const errorMessage = video.error?.message || "Erreur de lecture"

        console.error("Erreur vidéo:", errorCode, errorMessage)
        setError(
            "Impossible de charger la vidéo. Le lien a peut-être expiré. Veuillez actualiser la page."
        )
        setIsLoading(false)
    }

    const handleLoadStart = () => {
        console.log("📥 Début du chargement de la vidéo (streaming par chunks)")
        setIsLoading(true)
        setLoadingProgress(0)
    }

    const handleProgress = () => {
        const video = videoRef.current
        if (!video) return

        // Calculer le pourcentage de buffer chargé
        if (video.buffered.length > 0) {
            const bufferedEnd = video.buffered.end(video.buffered.length - 1)
            const duration = video.duration
            if (duration > 0) {
                const progress = (bufferedEnd / duration) * 100
                setLoadingProgress(Math.min(progress, 100))
            }
        }
    }

    const handleLoadedMetadata = () => {
        console.log("✅ Métadonnées chargées, prêt pour la lecture")
        setLoadingProgress(25)
    }

    const handleLoadedData = () => {
        console.log("🎬 Premières frames chargées, lecture possible")
        // Dès que les premières données sont là, on cache l'overlay
        // pour permettre le streaming progressif
        setIsLoading(false)
    }

    const handleCanPlay = () => {
        console.log("✅ Peut commencer la lecture")
        // Cache définitivement l'overlay si ce n'est pas déjà fait
        setIsLoading(false)
    }

    const handleCanPlayThrough = () => {
        console.log("✅ Toute la vidéo est chargée")
        setLoadingProgress(100)
    }

    return (
        <div className="relative w-full h-full">
            <video
                ref={videoRef}
                src={videoSrc}
                controls
                controlsList="nodownload"
                className={`${className} relative z-0`}
                preload="metadata"
                playsInline
                crossOrigin="anonymous"
                onError={handleError}
                onLoadStart={handleLoadStart}
                onLoadedMetadata={handleLoadedMetadata}
                onLoadedData={handleLoadedData}
                onProgress={handleProgress}
                onCanPlay={handleCanPlay}
                onCanPlayThrough={handleCanPlayThrough}
                style={{ position: 'relative', zIndex: 0 }}
            >
                Votre navigateur ne supporte pas la lecture vidéo.
            </video>

            {/* Overlay de chargement - pointer-events-none pour ne pas bloquer les contrôles */}
            {isLoading && !error && (
                // eslint-disable-next-line nokk-project/no-restricted-syntax -- scrim/overlay volontairement noir quel que soit le thème (design system §12.4)
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-white rounded-2xl z-20 backdrop-blur-sm pointer-events-none">
                    <Loader2 className="h-12 w-12 animate-spin mb-4" />
                    <div className="text-sm font-medium mb-2">
                        Chargement de la vidéo...
                    </div>
                    {/* Barre de progression */}
                    <div className="w-64 h-2 bg-card/20 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-card transition-[width] duration-slow ease-out"
                            style={{ width: `${loadingProgress}%` }}
                        />
                    </div>
                    <div className="text-xs text-card-foreground/70 mt-2">
                        {Math.round(loadingProgress)}%
                    </div>
                </div>
            )}

            {/* Message d'erreur */}
            {error && (
                // eslint-disable-next-line nokk-project/no-restricted-syntax -- scrim/overlay volontairement noir quel que soit le thème (design system §12.4)
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white text-sm p-4 rounded-2xl z-20">
                    {error}
                </div>
            )}
        </div>
    )
}
