import { AlertCircle, ArrowBigUpDash, Eye, EyeOff, Lock, Mail } from "lucide-react"
import { useEffect, useId, useState } from "react"
import { Link } from "react-router"
import { useAuthMood } from "@/features/auth/components/shell/authMood"
import { TurnstileField } from "@/features/auth/components/TurnstileField"
import type { AuthContextType } from "@/features/auth/hooks/useAuth/types"
import { useSignInForm, type SignInPhase } from "@/features/auth/hooks/useSignInForm"
import { Alert, AlertDescription } from "@/shared/ui/atoms/alert"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"

const BUTTON_LABEL: Record<SignInPhase, string> = {
    idle: "Se connecter",
    verifying: "Vérification de sécurité…",
    submitting: "Connexion…",
    success: "Connexion…",
}

interface SignInFormProps {
    signIn: AuthContextType["signIn"]
    email: string
    onEmailChange: (email: string) => void
    /** Focus initial sur le mot de passe quand l'email est prérempli. */
    emailPrefilled: boolean
}

export default function SignInForm({
    signIn,
    email,
    onEmailChange,
    emailPrefilled,
}: SignInFormProps) {
    const form = useSignInForm({ signIn, email })
    const { setMood, hop } = useAuthMood()

    // Le logo suit la soumission : vague pendant l'attente, saut au succès.
    useEffect(() => {
        if (form.phase === "verifying" || form.phase === "submitting") setMood("busy")
        else if (form.phase === "success") setMood("success")
    }, [form.phase, setMood])

    // …et secousse à chaque échec (`attempt` ne bouge qu'à un échec).
    useEffect(() => {
        if (form.attempt > 0) setMood("error")
    }, [form.attempt, setMood])
    const [showPassword, setShowPassword] = useState(false)
    const [capsLock, setCapsLock] = useState(false)
    const [captchaInteractive, setCaptchaInteractive] = useState(false)
    const emailId = useId()
    const passwordId = useId()
    const errorId = useId()
    const capsId = useId()

    const busy = form.phase !== "idle"
    const describedBy = [form.error && errorId, capsLock && capsId]
        .filter(Boolean)
        .join(" ") || undefined

    const trackCapsLock = (e: React.KeyboardEvent<HTMLInputElement>) => {
        setCapsLock(e.getModifierState("CapsLock"))
    }

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault()
                void form.submit()
            }}
            className="space-y-4"
            noValidate
        >
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
                            onEmailChange(e.target.value)
                            form.clearError()
                            hop()
                        }}
                        autoFocus={!emailPrefilled}
                        data-autofocus={!emailPrefilled || undefined}
                        disabled={busy}
                        aria-invalid={!!form.error}
                        aria-describedby={form.error ? errorId : undefined}
                        className="h-11 pl-10 lg:h-10"
                        required
                    />
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor={passwordId}>Mot de passe</Label>
                <div className="relative">
                    <Lock
                        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                        aria-hidden
                    />
                    <Input
                        ref={form.passwordRef}
                        id={passwordId}
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        value={form.password}
                        onChange={(e) => {
                            form.setPassword(e.target.value)
                            form.clearError()
                            hop()
                        }}
                        onKeyDown={trackCapsLock}
                        onKeyUp={trackCapsLock}
                        // Mot de passe en cours de saisie : le logo « détourne
                        // le regard ». Pas pendant une soumission, qui a la main.
                        onFocus={() => {
                            if (!busy) setMood("secret")
                        }}
                        onBlur={() => {
                            setCapsLock(false)
                            if (!busy) setMood("idle")
                        }}
                        autoFocus={emailPrefilled}
                        data-autofocus={emailPrefilled || undefined}
                        disabled={busy}
                        aria-invalid={!!form.error}
                        aria-describedby={describedBy}
                        className="h-11 pr-11 pl-10 lg:h-10"
                        required
                    />
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                        aria-pressed={showPassword}
                        className="absolute top-0 right-0 size-11 text-muted-foreground hover:bg-transparent hover:text-foreground lg:size-10"
                    >
                        {showPassword ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
                    </Button>
                </div>
                {capsLock && (
                    <p id={capsId} className="flex items-center gap-1.5 text-xs text-warning">
                        <ArrowBigUpDash className="size-3.5" aria-hidden />
                        Verrouillage majuscules activé
                    </p>
                )}
            </div>

            {form.error && (
                <Alert
                    key={form.attempt}
                    variant="destructive"
                    id={errorId}
                    className="animate-shake"
                >
                    <AlertCircle className="size-4" aria-hidden />
                    <AlertDescription>{form.error}</AlertDescription>
                </Alert>
            )}

            {captchaInteractive && (
                <p className="text-center text-xs text-muted-foreground">
                    Une vérification rapide est nécessaire avant de continuer.
                </p>
            )}
            <TurnstileField ref={form.captchaRef} onInteractiveChange={setCaptchaInteractive} />

            <Button
                type="submit"
                className="h-11 w-full lg:h-10"
                loading={busy}
            >
                {BUTTON_LABEL[form.phase]}
            </Button>

            <div className="text-center">
                <Button
                    asChild
                    variant="link"
                    className="h-11 text-sm text-muted-foreground lg:h-auto"
                >
                    <Link
                        to={
                            email.trim()
                                ? `/forgot-password?email=${encodeURIComponent(email.trim())}`
                                : "/forgot-password"
                        }
                    >
                        Mot de passe oublié ?
                    </Link>
                </Button>
            </div>
        </form>
    )
}
