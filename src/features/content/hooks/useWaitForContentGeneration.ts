import { subscribeToGenerationUpdates } from "@/features/content/services/contentGenerationService"
import { useEffect } from "react"

interface UseWaitForContentGenerationProps {
    userId: string
    onDone: (url: string, isVideo: boolean) => void
    onError?: (err: string) => void
}

/**
 * 🎧 Écoute en temps réel la table content_generation
 * et déclenche un callback dès qu'une génération (image/vidéo) est terminée.
 *
 * - Utilise Supabase Realtime (postgres_changes)
 * - Détecte automatiquement image_url ou video_url
 * - Supporte plusieurs générations en parallèle
 */
export function useWaitForContentGeneration({
    userId,
    onDone,
    onError,
}: UseWaitForContentGenerationProps) {
    useEffect(() => {
        if (!userId) return

        const unsubscribe = subscribeToGenerationUpdates(
            "content_generation_realtime",
            userId,
            (row) => {
                try {
                    if (row.status === "done") {
                            const url = row.video_url || row.image_url
                        if (url) {
                            const isVideo = url.endsWith(".mp4")
                            onDone(url, isVideo)
                        } else {
                            console.warn(
                                "⚠️ Aucun URL trouvé pour la génération terminée:",
                                row
                            )
                        }
                    }
                } catch (err) {
                    console.error("Erreur Realtime:", err)
                    onError?.(
                        err instanceof Error
                            ? err.message
                            : "Erreur interne Realtime"
                    )
                }
            },
            () => {
                console.log(
                    `✅ Realtime activé pour content_generation de ${userId}`
                )
            }
        )

        return unsubscribe
    }, [userId, onDone, onError])
}
