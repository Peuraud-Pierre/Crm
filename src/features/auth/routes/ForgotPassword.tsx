import { AlertCircle, ArrowLeft, Mail, MailCheck } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
import { Link, useSearchParams } from "react-router"
import { AuthShell } from "@/features/auth/components/shell/AuthShell"
import { MoodSignal } from "@/features/auth/components/shell/authMood"
import {
    TurnstileField,
    type TurnstileHandle,
} from "@/features/auth/components/TurnstileField"
import { resetPasswordForEmail } from "@/features/auth/services/authService"
import { toAuthMessage } from "@/features/auth/utils/authErrors"
import { Alert, AlertDescription } from "@/shared/ui/atoms/alert"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"

/** Délai avant de pouvoir redemander un lien (aligné sur la limite GoTrue). */
const RESEND_COOLDOWN_S = 60

/** « nathalie@exemple.fr » → « n•••@exemple.fr » : rappel sans tout afficher. */
function maskEmail(email: string): string {
    const [local, domain] = email.split("@")
    if (!domain) return email
    return `${local.slice(0, 1)}•••@${domain}`
}

function useCooldown() {
    const [remaining, setRemaining] = useState(0)

    useEffect(() => {
        if (remaining <= 0) return
        const id = setTimeout(() => setRemaining((s) => s - 1), 1000)
        return () => clearTimeout(id)
    }, [remaining])

    return { remaining, start: () => setRemaining(RESEND_COOLDOWN_S) }
}

export default function ForgotPassword() {
    const [searchParams] = useSearchParams()
    const [email, setEmail] = useState(() => searchParams.get("email") ?? "")
    const [sentTo, setSentTo] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [attempt, setAttempt] = useState(0)
    const captchaRef = useRef<TurnstileHandle>(null)
    const cooldown = useCooldown()
    const emailId = useId()
    const errorId = useId()

    const send = async (target: string) => {
        setLoading(true)
        setError(null)

        let token: string
        try {
            token = (await captchaRef.current?.getToken()) ?? ""
        } catch {
            setError("La vérification de sécurité n'a pas abouti. Réessayez.")
            setAttempt((n) => n + 1)
            captchaRef.current?.reset()
            setLoading(false)
            return
        }

        try {
            const { error: sendError } = await resetPasswordForEmail(target, {
                redirectTo: `${window.location.origin}/reset-password`,
                captchaToken: token,
            })
            if (sendError) throw sendError

            setSentTo(target)
            cooldown.start()
        } catch (err) {
            console.error("Error sending reset email:", err)
            setError(toAuthMessage(err))
            setAttempt((n) => n + 1)
        } finally {
            // Jeton à usage unique : consommé par GoTrue, succès ou échec.
            captchaRef.current?.reset()
            setLoading(false)
        }
    }

    const handleSubmit = (e: React.SubmitEvent<HTMLFormElement>) => {
        e.preventDefault()
        const target = email.trim()
        if (!target) {
            setError("Saisissez votre adresse email.")
            setAttempt((n) => n + 1)
            return
        }
        void send(target)
    }

    const errorAlert = error && (
        <Alert key={attempt} variant="destructive" id={errorId} className="animate-shake">
            <AlertCircle className="size-4" aria-hidden />
            <AlertDescription>{error}</AlertDescription>
        </Alert>
    )

    const backToLogin = (
        <Button asChild variant="ghost" className="h-11 text-muted-foreground lg:h-10">
            <Link to="/login">
                <ArrowLeft aria-hidden />
                Retour à la connexion
            </Link>
        </Button>
    )

    // Présent dans les deux états : le renvoi depuis l'écran « envoyé » a
    // lui aussi besoin d'un jeton.
    const captcha = <TurnstileField ref={captchaRef} />

    if (sentTo) {
        return (
            <AuthShell
                stepKey="sent"
                mood="success"
                title="Vérifiez votre boîte mail"
                description={
                    <>
                        Si un compte existe pour{" "}
                        <span className="font-medium text-foreground">{maskEmail(sentTo)}</span>,
                        un lien de réinitialisation vient de lui être envoyé.
                    </>
                }
                icon={
                    <div className="flex size-14 items-center justify-center rounded-full bg-success/10 text-success animate-in zoom-in-50 duration-slow ease-emphasized">
                        <MailCheck className="size-7" aria-hidden />
                    </div>
                }
                footer={backToLogin}
            >
                <div className="space-y-4">
                    <MoodSignal
                        mood={loading ? "busy" : error ? "error" : "success"}
                        trigger={attempt}
                    />
                    {errorAlert}
                    {captcha}
                    <Button
                        type="button"
                        variant="outline"
                        className="h-11 w-full lg:h-10"
                        loading={loading}
                        disabled={cooldown.remaining > 0}
                        onClick={() => void send(sentTo)}
                    >
                        {cooldown.remaining > 0
                            ? `Renvoyer le lien (${cooldown.remaining} s)`
                            : "Renvoyer le lien"}
                    </Button>
                    <p className="text-center text-xs text-muted-foreground text-pretty">
                        Rien reçu ? Regardez dans les courriers indésirables avant de renvoyer.
                    </p>
                </div>
            </AuthShell>
        )
    }

    return (
        <AuthShell
            stepKey="form"
            title="Mot de passe oublié"
            description="Saisissez votre adresse email : nous vous enverrons un lien pour choisir un nouveau mot de passe."
            footer={backToLogin}
        >
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <MoodSignal
                    mood={loading ? "busy" : error ? "error" : null}
                    trigger={attempt}
                    typed={email.length}
                />
                <div className="space-y-2">
                    <Label htmlFor={emailId}>Email</Label>
                    <div className="relative">
                        <Mail
                            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                            aria-hidden
                        />
                        <Input
                            id={emailId}
                            type="email"
                            inputMode="email"
                            autoComplete="username"
                            autoCapitalize="none"
                            spellCheck={false}
                            placeholder="Votre adresse email"
                            value={email}
                            onChange={(e) => {
                                setEmail(e.target.value)
                                setError(null)
                            }}
                            autoFocus
                            data-autofocus
                            disabled={loading}
                            aria-invalid={!!error}
                            aria-describedby={error ? errorId : undefined}
                            className="h-11 pl-10 lg:h-10"
                            required
                        />
                    </div>
                </div>

                {errorAlert}
                {captcha}

                <Button type="submit" className="h-11 w-full lg:h-10" loading={loading}>
                    {loading ? "Envoi…" : "Envoyer le lien"}
                </Button>
            </form>
        </AuthShell>
    )
}
