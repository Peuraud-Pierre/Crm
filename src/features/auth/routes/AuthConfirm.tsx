import { CircleCheck, Link2Off } from "lucide-react"
import { useEffect, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router"
import { AuthShell } from "@/features/auth/components/shell/AuthShell"
import { verifyEmailOtp } from "@/features/auth/services/authService"
import { Button } from "@/shared/ui/atoms/button"

type Outcome =
    | { status: "verifying" }
    | { status: "confirmed" }
    | { status: "invalid"; retry: "forgot-password" | "login" }

/**
 * Atterrissage des liens envoyés par email (`?token_hash=…&type=…`).
 * - recovery : échange le jeton contre une session puis enchaîne sur
 *   /reset-password, sans écran intermédiaire ;
 * - signup : confirme l'adresse et le dit sur place ;
 * - lien invalide ou expiré : l'explique sur place, avec l'action utile,
 *   plutôt qu'un toast suivi d'une redirection que l'on n'a pas le temps de lire.
 */
export default function AuthConfirm() {
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const [outcome, setOutcome] = useState<Outcome>({ status: "verifying" })

    useEffect(() => {
        let cancelled = false
        const tokenHash = searchParams.get("token_hash")
        const type = searchParams.get("type")

        const confirm = async () => {
            if (!tokenHash || (type !== "recovery" && type !== "signup")) {
                setOutcome({ status: "invalid", retry: "login" })
                return
            }

            const retry = type === "recovery" ? "forgot-password" : "login"
            try {
                const { data, error } = await verifyEmailOtp(tokenHash, type)
                if (cancelled) return
                if (error) {
                    console.error(`Error verifying ${type} token:`, error)
                    setOutcome({ status: "invalid", retry })
                    return
                }
                if (type === "recovery") {
                    if (data.session) {
                        navigate("/reset-password", { replace: true })
                    } else {
                        setOutcome({ status: "invalid", retry })
                    }
                    return
                }
                setOutcome({ status: "confirmed" })
            } catch (err) {
                console.error("Error during auth confirmation:", err)
                if (!cancelled) setOutcome({ status: "invalid", retry })
            }
        }

        void confirm()
        return () => {
            cancelled = true
        }
    }, [searchParams, navigate])

    if (outcome.status === "verifying") {
        return (
            <AuthShell
                pending
                stepKey="verifying"
                title="Vérification en cours…"
                description="Un instant, nous vérifions votre lien."
            />
        )
    }

    if (outcome.status === "confirmed") {
        return (
            <AuthShell
                stepKey="confirmed"
                mood="success"
                title="Adresse email confirmée"
                description="Votre compte est prêt. Vous pouvez vous connecter."
                icon={
                    <div className="flex size-14 items-center justify-center rounded-full bg-success/10 text-success animate-in zoom-in-50 duration-slow ease-overshoot">
                        <CircleCheck className="size-7" aria-hidden />
                    </div>
                }
            >
                <Button asChild className="h-11 w-full lg:h-10">
                    <Link to="/login">Se connecter</Link>
                </Button>
            </AuthShell>
        )
    }

    const isRecovery = outcome.retry === "forgot-password"
    return (
        <AuthShell
            stepKey="invalid"
            mood="error"
            title="Lien invalide ou expiré"
            description={
                isRecovery
                    ? "Ce lien de réinitialisation n'est plus utilisable. Demandez-en un nouveau."
                    : "Ce lien n'est plus utilisable. Il a peut-être déjà servi, ou il a expiré."
            }
            icon={
                <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                    <Link2Off className="size-7" aria-hidden />
                </div>
            }
        >
            <div className="space-y-2">
                {isRecovery && (
                    <Button asChild className="h-11 w-full lg:h-10">
                        <Link to="/forgot-password">Demander un nouveau lien</Link>
                    </Button>
                )}
                <Button
                    asChild
                    variant={isRecovery ? "ghost" : "default"}
                    className="h-11 w-full lg:h-10"
                >
                    <Link to="/login">Retour à la connexion</Link>
                </Button>
            </div>
        </AuthShell>
    )
}
