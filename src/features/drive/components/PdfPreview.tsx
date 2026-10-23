import { Loader2 } from "lucide-react"
import { useEffect, useState } from "react"

/**
 * Au-delà de cette taille, le PDF n'est plus prévisualisé : il faudrait le
 * charger entièrement en mémoire avant d'afficher la première page.
 */
const MAX_PREVIEW_BYTES = 20 * 1024 * 1024

/**
 * Aperçu PDF.
 *
 * Le fichier est récupéré en blob plutôt que pointé directement par l'iframe :
 * le host de l'API répond `frame-ancestors 'self'`, qui interdit à une page
 * d'une autre origine de l'encadrer. Un blob: appartient à l'origine du front,
 * la directive ne s'y applique donc pas.
 *
 * Contrepartie assumée : le fichier est téléchargé en entier avant affichage,
 * d'où la borne de taille.
 */
export default function PdfPreview({
    url,
    title,
    sizeBytes,
    className = "",
}: {
    url: string
    title?: string
    sizeBytes?: number
    className?: string
}) {
    const [blobUrl, setBlobUrl] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const tooLarge = !!sizeBytes && sizeBytes > MAX_PREVIEW_BYTES

    useEffect(() => {
        if (tooLarge) return

        let cancelled = false
        let objectUrl: string | null = null

        fetch(url)
            .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`)
                return res.blob()
            })
            .then((blob) => {
                if (cancelled) return
                objectUrl = URL.createObjectURL(blob)
                setBlobUrl(objectUrl)
            })
            .catch(() => {
                if (!cancelled) setError("Aperçu indisponible")
            })

        return () => {
            cancelled = true
            // Révoqué au démontage : sans quoi chaque ouverture d'aperçu
            // laisserait un blob en mémoire jusqu'au rechargement de l'onglet.
            if (objectUrl) URL.revokeObjectURL(objectUrl)
        }
    }, [url, tooLarge])

    if (tooLarge || error) {
        return (
            <div className="flex w-full flex-col items-center justify-center gap-3 rounded-lg bg-muted/40 py-12 sm:rounded-2xl">
                <p className="text-sm text-muted-foreground">
                    {tooLarge
                        ? "Document trop volumineux pour l'aperçu"
                        : error}
                    {" — utilisez Télécharger."}
                </p>
            </div>
        )
    }

    if (!blobUrl) {
        return (
            <div className="flex w-full items-center justify-center py-12">
                <Loader2
                    className="h-8 w-8 animate-spin text-muted-foreground"
                    aria-hidden="true"
                />
            </div>
        )
    }

    return (
        <iframe
            src={blobUrl}
            title={title ?? "Document PDF"}
            className={className}
        />
    )
}
