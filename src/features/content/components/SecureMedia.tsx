import { getAccessToken } from "@/features/content/services/contentGenerationService"
import { SkeletonText } from "@/shared/ui/molecules/skeleton-presets"
import { useEffect, useState } from "react"

interface SecureMediaProps {
    src: string
    alt?: string
    isVideo?: boolean
    className?: string
}

export default function SecureMedia({
    src,
    alt,
    isVideo,
    className,
}: SecureMediaProps) {
    const [blobUrl, setBlobUrl] = useState<string | null>(null)
    const [error, setError] = useState(false)

    useEffect(() => {
        if (!src) return

        const isProtected =
            src.includes("/n8n_auth/") || src.includes("/n8n_image/")
        const isSigned = src.includes("sig=")

        // URL signée : fetch en blob sans auth (la signature suffit)
        // Nécessaire pour les vidéos cross-origin bloquées par CSP
        if (isSigned) {
            const fetchSigned = async () => {
                try {
                    const response = await fetch(src)
                    if (!response.ok) throw new Error(`Erreur ${response.status}`)
                    const blob = await response.blob()

                    let finalBlob = blob
                    if (isVideo && !blob.type.startsWith("video/")) {
                        finalBlob = new Blob([blob], { type: "video/mp4" })
                    }

                    setBlobUrl(URL.createObjectURL(finalBlob))
                } catch (err) {
                    console.error("❌ Erreur chargement média signé :", err)
                    setError(true)
                }
            }
            fetchSigned()
            return () => {
                if (blobUrl) URL.revokeObjectURL(blobUrl)
            }
        }

        // URL non protégée : utiliser directement
        if (!isProtected) {
            // Resync de l'état dérivé sur changement de src (les autres branches
            // sont asynchrones, impossible de factoriser en useMemo).
            // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
            setBlobUrl(src)
            return
        }

        // URL protégée sans signature : fetch avec JWT
        const fetchWithAuth = async () => {
            try {
                const token = await getAccessToken()
                if (!token) throw new Error("Missing JWT")

                const response = await fetch(src, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                })

                if (!response.ok) throw new Error(`Erreur ${response.status}`)

                const contentType = response.headers.get("content-type")
                console.log(`📦 SecureMedia fetch: status=${response.status}, content-type=${contentType}, url=${src.substring(0, 80)}...`)

                const blob = await response.blob()
                console.log(`📦 SecureMedia blob: size=${blob.size}, type=${blob.type}`)

                // Si le blob est trop petit, c'est probablement une erreur HTML
                if (isVideo && blob.size < 1000) {
                    const text = await blob.text()
                    console.error("❌ Réponse inattendue pour la vidéo :", text.substring(0, 200))
                    throw new Error("Le serveur n'a pas renvoyé une vidéo valide")
                }

                // Si le blob n'a pas le bon type MIME, on force video/mp4
                let finalBlob = blob
                if (isVideo && !blob.type.startsWith("video/")) {
                    finalBlob = new Blob([blob], { type: "video/mp4" })
                }

                setBlobUrl(URL.createObjectURL(finalBlob))
            } catch (err) {
                console.error("❌ Erreur chargement média sécurisé :", err)
                setError(true)
            }
        }

        fetchWithAuth()

        return () => {
            if (blobUrl) URL.revokeObjectURL(blobUrl)
        }
    }, [src])

    if (error) {
        return (
            <div className="flex items-center justify-center text-destructive text-sm">
                Erreur de chargement du média
            </div>
        )
    }

    if (!blobUrl) {
        return (
            <div className="flex items-center justify-center p-4">
                <SkeletonText lines={1} label="Chargement du média…" className="w-24" />
            </div>
        )
    }

    if (isVideo) {
        return (
            <video
                src={blobUrl}
                controls
                loop
                playsInline
                className={className}
            />
        )
    }

    return <img src={blobUrl} alt={alt ?? "Résultat"} className={className} />
}
