import { AlertCircle, Check, CircleCheck, Eye, EyeOff, Link2Off, X } from "lucide-react"
import { useEffect, useId, useState } from "react"
import { Link, useNavigate } from "react-router"
import { OtpStep } from "@/features/auth/components/OtpStep"
import { AuthShell } from "@/features/auth/components/shell/AuthShell"
import { MoodSignal } from "@/features/auth/components/shell/authMood"
import {
    getCurrentAAL,
    hasAAL2Enabled,
    verifyOtp,
} from "@/features/auth/hooks/useAuth/auth.mfa"
import {
    getSession,
    updateUserPassword,
} from "@/features/auth/services/authService"
import { toAuthMessage } from "@/features/auth/utils/authErrors"
import { cn } from "@/shared/lib/utils"
import { Alert, AlertDescription } from "@/shared/ui/atoms/alert"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"
import {
    isPasswordStrong,
    PasswordStrength,
} from "@/shared/ui/molecules/password-strength"

/** Délai de lecture de l'écran de succès avant le retour à la connexion. */
const REDIRECT_DELAY_MS = 2500

type Stage = "checking" | "invalid" | "mfa" | "form" | "success"

export default function ResetPassword() {
    const navigate = useNavigate()
    const [stage, setStage] = useState<Stage>("checking")

    useEffect(() => {
        let cancelled = false
        // Le lien de récupération (AuthConfirm) ouvre une session AAL1. Si le
        // compte a un TOTP, Supabase exige l'AAL2 pour changer le mot de passe.
        const checkSessionAndMfa = async () => {
            const {
                data: { session },
            } = await getSession()
            if (cancelled) return
            if (!session) {
                setStage("invalid")
                return
            }

            const hasMfa = await hasAAL2Enabled()
            const needsMfa = hasMfa && (await getCurrentAAL()) === "aal1"
            if (!cancelled) setStage(needsMfa ? "mfa" : "form")
        }
        void checkSessionAndMfa()
        return () => {
            cancelled = true
        }
    }, [])

    useEffect(() => {
        if (stage !== "success") return
        const id = setTimeout(() => navigate("/login"), REDIRECT_DELAY_MS)
        return () => clearTimeout(id)
    }, [stage, navigate])

    const backToLogin = (
        <Button asChild variant="ghost" className="h-11 text-muted-foreground lg:h-10">
            <Link to="/login">Retour à la connexion</Link>
        </Button>
    )

    switch (stage) {
        case "checking":
            return (
                <AuthShell
                    pending
                    stepKey="checking"
                    title="Vérification du lien…"
                    description="Un instant, nous vérifions votre lien de réinitialisation."
                />
            )

        case "invalid":
            return (
                <AuthShell
                    stepKey="invalid"
                    mood="error"
                    title="Lien invalide ou expiré"
                    description="Ce lien de réinitialisation n'est plus utilisable. Demandez-en un nouveau : il n'est valable qu'une fois."
                    icon={
                        <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                            <Link2Off className="size-7" aria-hidden />
                        </div>
                    }
                    footer={backToLogin}
                >
                    <Button asChild className="h-11 w-full lg:h-10">
                        <Link to="/forgot-password">Demander un nouveau lien</Link>
                    </Button>
                </AuthShell>
            )

        case "mfa":
            return (
                <AuthShell
                    stepKey="mfa"
                    title="Confirmez votre identité"
                    description="Votre compte est protégé par la double authentification. Saisissez le code de votre application pour choisir un nouveau mot de passe."
                    footer={backToLogin}
                >
                    <OtpStep verifyOtp={verifyOtp} onVerified={() => setStage("form")} />
                </AuthShell>
            )

        case "success":
            return (
                <AuthShell
                    stepKey="success"
                    mood="success"
                    title="Mot de passe modifié"
                    description="Vous allez être redirigé vers la page de connexion."
                    icon={
                        <div className="flex size-14 items-center justify-center rounded-full bg-success/10 text-success animate-in zoom-in-50 duration-slow ease-overshoot">
                            <CircleCheck className="size-7" aria-hidden />
                        </div>
                    }
                >
                    <Button asChild className="h-11 w-full lg:h-10">
                        <Link to="/login">Se connecter maintenant</Link>
                    </Button>
                </AuthShell>
            )

        case "form":
            return (
                <AuthShell
                    stepKey="form"
                    title="Nouveau mot de passe"
                    description="Choisissez un mot de passe que vous n'utilisez nulle part ailleurs."
                    footer={backToLogin}
                >
                    <NewPasswordForm onDone={() => setStage("success")} />
                </AuthShell>
            )
    }
}

function NewPasswordForm({ onDone }: { onDone: () => void }) {
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [attempt, setAttempt] = useState(0)
    const passwordId = useId()
    const confirmId = useId()
    const matchId = useId()
    const errorId = useId()

    const strong = isPasswordStrong(password)
    const matches = confirmPassword.length > 0 && confirmPassword === password

    const fail = (message: string) => {
        setError(message)
        setAttempt((n) => n + 1)
    }

    const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
        e.preventDefault()
        if (!strong) return fail("Le mot de passe ne remplit pas encore tous les critères.")
        if (!matches) return fail("Les deux mots de passe ne correspondent pas.")

        setLoading(true)
        setError(null)
        try {
            const { error: updateError } = await updateUserPassword(password)
            if (updateError) throw updateError
            onDone()
        } catch (err) {
            console.error("Error resetting password:", err)
            fail(toAuthMessage(err))
        } finally {
            setLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <MoodSignal
                mood={loading ? "busy" : error ? "error" : null}
                trigger={attempt}
                typed={password.length + confirmPassword.length}
            />
            <div className="space-y-2">
                <Label htmlFor={passwordId}>Nouveau mot de passe</Label>
                <div className="relative">
                    <Input
                        id={passwordId}
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        autoFocus
                        data-autofocus
                        value={password}
                        onChange={(e) => {
                            setPassword(e.target.value)
                            setError(null)
                        }}
                        disabled={loading}
                        className="h-11 pr-11 lg:h-10"
                        required
                    />
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? "Masquer les mots de passe" : "Afficher les mots de passe"}
                        aria-pressed={showPassword}
                        className="absolute top-0 right-0 size-11 text-muted-foreground hover:bg-transparent hover:text-foreground lg:size-10"
                    >
                        {showPassword ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
                    </Button>
                </div>
                <PasswordStrength password={password} />
            </div>

            <div className="space-y-2">
                <Label htmlFor={confirmId}>Confirmer le mot de passe</Label>
                <Input
                    id={confirmId}
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => {
                        setConfirmPassword(e.target.value)
                        setError(null)
                    }}
                    disabled={loading}
                    aria-invalid={confirmPassword.length > 0 && !matches}
                    aria-describedby={confirmPassword ? matchId : undefined}
                    className="h-11 lg:h-10"
                    required
                />
                {confirmPassword.length > 0 && (
                    <p
                        id={matchId}
                        className={cn(
                            "flex items-center gap-1.5 text-xs",
                            matches ? "text-success" : "text-muted-foreground"
                        )}
                    >
                        {matches ? (
                            <Check className="size-3" aria-hidden />
                        ) : (
                            <X className="size-3" aria-hidden />
                        )}
                        {matches
                            ? "Les mots de passe correspondent"
                            : "Les mots de passe ne correspondent pas encore"}
                    </p>
                )}
            </div>

            {error && (
                <Alert key={attempt} variant="destructive" id={errorId} className="animate-shake">
                    <AlertCircle className="size-4" aria-hidden />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            <Button type="submit" className="h-11 w-full lg:h-10" loading={loading}>
                {loading ? "Enregistrement…" : "Enregistrer le mot de passe"}
            </Button>
        </form>
    )
}
