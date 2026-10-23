/**
 * Page de callback OAuth pour Microsoft Outlook
 * Cette page gère le retour après l'authentification OAuth
 */

import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router"
import { MainLayout } from "@/shared/components/layout/MainLayout"
import { Loader2, CheckCircle, AlertCircle } from "lucide-react"

export default function OutlookCallback() {
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const [status, setStatus] = useState<"processing" | "success" | "error">(
        "processing"
    )
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let redirectTimer: ReturnType<typeof setTimeout> | undefined

        const processCallback = async () => {
            try {
                // Récupérer les paramètres OAuth
                const code = searchParams.get("code")
                const state = searchParams.get("state")
                const errorParam = searchParams.get("error")
                const errorDescription = searchParams.get("error_description")

                // Gérer les erreurs OAuth
                if (errorParam) {
                    throw new Error(
                        errorDescription ||
                            `OAuth error: ${errorParam}`
                    )
                }

                // Vérifier la présence du code
                if (!code || !state) {
                    throw new Error(
                        "Missing authorization code or state parameter"
                    )
                }

                // L'échange OAuth n'est plus supporté : useOutlookAuth est passé
                // à une connexion EWS par identifiants (email/mot de passe) et
                // n'expose plus handleCallback. On conserve le comportement
                // observé (statut "error" puis redirection vers le calendrier).
                throw new Error(
                    "Le flux OAuth Outlook n'est plus supporté — utilisez la connexion par identifiants depuis le profil."
                )
            } catch (err) {
                console.error("OAuth callback error:", err)
                setError(
                    err instanceof Error
                        ? err.message
                        : "Une erreur est survenue"
                )
                setStatus("error")

                // Rediriger vers le calendrier après 5 secondes en cas d'erreur
                redirectTimer = setTimeout(() => {
                    navigate("/crm?tab=calendar")
                }, 5000)
            }
        }

        processCallback()

        return () => {
            if (redirectTimer) clearTimeout(redirectTimer)
        }
    }, [searchParams, navigate])

    return (
        <MainLayout>
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center space-y-4 max-w-md">
                    {status === "processing" && (
                        <>
                            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
                            <h2 className="text-2xl font-bold">
                                Connexion à Outlook...
                            </h2>
                            <p className="text-muted-foreground">
                                Veuillez patienter pendant que nous finalisons
                                la connexion.
                            </p>
                        </>
                    )}

                    {status === "success" && (
                        <>
                            <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
                            <h2 className="text-2xl font-bold text-green-600">
                                Connexion réussie !
                            </h2>
                            <p className="text-muted-foreground">
                                Votre calendrier Outlook est maintenant
                                synchronisé avec Nokk_project.
                            </p>
                            <p className="text-sm text-muted-foreground">
                                Redirection vers le calendrier...
                            </p>
                        </>
                    )}

                    {status === "error" && (
                        <>
                            <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
                            <h2 className="text-2xl font-bold text-red-600">
                                Échec de connexion
                            </h2>
                            <p className="text-muted-foreground">
                                {error ||
                                    "Une erreur est survenue lors de la connexion à Outlook."}
                            </p>
                            <p className="text-sm text-muted-foreground">
                                Redirection vers le calendrier...
                            </p>
                        </>
                    )}
                </div>
            </div>
        </MainLayout>
    )
}
