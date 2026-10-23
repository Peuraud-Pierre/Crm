import { Button } from "@/shared/ui/atoms/button"
import { subscribeToGenerationUpdates } from "@/features/content/services/contentGenerationService"
import { CheckCircle2, Download, Loader2, XCircle } from "lucide-react"
import { useEffect, useState } from "react"

interface WaitingPanelProps {
    open: boolean
    userId: string
    title?: string
    etaMs?: number
    onClose: () => void
}

export function WaitingPanel({
    open,
    userId,
    title = "Traitement en cours...",
    etaMs = 30000,
    onClose,
}: WaitingPanelProps) {
    const [progress, setProgress] = useState(0)
    const [resultUrl, setResultUrl] = useState<string | null>(null)
    const [isVideo, setIsVideo] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // 🕒 Animation visuelle du chargement
    useEffect(() => {
        if (!open || resultUrl) return
        const start = Date.now()
        const interval = setInterval(() => {
            const elapsed = Date.now() - start
            const pct = Math.min(100, (elapsed / etaMs) * 100)
            setProgress(pct)
        }, 300)
        return () => clearInterval(interval)
    }, [open, etaMs, resultUrl])

    // 🎧 Écoute en temps réel content_generation
    useEffect(() => {
        if (!open || !userId) return

        const unsubscribe = subscribeToGenerationUpdates(
            "content_generation_realtime_panel",
            userId,
            (row) => {
                if (row.status === "done") {
                    const url = row.video_url || row.image_url
                    if (url) {
                        setResultUrl(url)
                        setIsVideo(url.endsWith(".mp4"))
                        setProgress(100)
                    } else {
                        setError("Aucun fichier retourné")
                    }
                } else if (row.status === "error") {
                    setError("Erreur pendant la génération")
                }
            },
            () => {
                console.log("✅ WaitingPanel connecté au Realtime Supabase")
            }
        )

        return unsubscribe
    }, [open, userId])

    // 🧩 Rendu principal
    return (
        <div className="h-full flex flex-col items-center justify-center p-6">
            {!resultUrl && !error && (
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    <h2 className="text-lg font-medium text-center">{title}</h2>
                    <div className="w-64 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                            className="h-full bg-primary transition-[width] duration-slower ease-out"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <p className="text-sm text-muted-foreground">
                        {progress < 100
                            ? "Veuillez patienter..."
                            : "Finalisation du rendu..."}
                    </p>
                    <Button variant="outline" onClick={onClose}>
                        Annuler
                    </Button>
                </div>
            )}

            {error && (
                <div className="flex flex-col items-center gap-4 text-center">
                    <XCircle className="w-10 h-10 text-destructive" />
                    <h2 className="text-lg font-semibold text-destructive">
                        Erreur de génération
                    </h2>
                    <p className="text-sm text-muted-foreground">{error}</p>
                    <Button variant="outline" onClick={onClose}>
                        Fermer
                    </Button>
                </div>
            )}

            {resultUrl && (
                <div className="flex flex-col items-center gap-4 text-center">
                    <CheckCircle2 className="w-10 h-10 text-green-500" />
                    <h2 className="text-lg font-semibold text-green-600">
                        Résultat prêt !
                    </h2>

                    <div className="max-w-md w-full rounded-xl overflow-hidden border border-border shadow-md bg-background">
                        {isVideo ? (
                            <video
                                src={resultUrl}
                                controls
                                autoPlay
                                loop
                                playsInline
                                className="w-full h-auto"
                            />
                        ) : (
                            <img
                                src={resultUrl}
                                alt="Résultat"
                                className="w-full h-auto object-contain"
                            />
                        )}
                    </div>

                    <div className="flex gap-2">
                        <Button asChild>
                            <a href={resultUrl} download target="_blank" rel="noreferrer">
                                <Download className="w-4 h-4 mr-1" />{" "}
                                Télécharger
                            </a>
                        </Button>
                        <Button variant="outline" onClick={onClose}>
                            Fermer
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
