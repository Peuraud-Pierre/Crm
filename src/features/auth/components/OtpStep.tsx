import { REGEXP_ONLY_DIGITS } from "input-otp"
import { AlertCircle, ArrowLeft, Check, Smartphone } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
import { Alert, AlertDescription } from "@/shared/ui/atoms/alert"
import { Button } from "@/shared/ui/atoms/button"
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSeparator,
    InputOTPSlot,
} from "@/shared/ui/molecules/input-otp"
import { cn } from "@/shared/lib/utils"
import { useAuthMood } from "./shell/authMood"

const CODE_LENGTH = 6
// Clés stables des cases : l'index seul est refusé par la règle react/no-array-index-key.
const FIRST_GROUP = ["d0", "d1", "d2"] as const
const SECOND_GROUP = ["d3", "d4", "d5"] as const

export interface OtpStepProps {
    /** Doit renvoyer `error` déjà traduit (voir utils/authErrors). */
    verifyOtp: (code: string) => Promise<{ error?: string | null }>
    /** Appelé une fois le code accepté. */
    onVerified?: () => void
    /** Affiche « Utiliser un autre compte » quand fourni. */
    onCancel?: () => void | Promise<void>
    /** Compte concerné, rappelé au-dessus des cases. */
    email?: string
}

type Status = "idle" | "verifying" | "success"

/**
 * Saisie du code TOTP à 6 chiffres. Partagée par la connexion et la
 * réinitialisation de mot de passe (session AAL1 à élever en AAL2).
 *
 * - Soumission automatique au 6e chiffre ; le bouton reste là pour qui
 *   préfère valider explicitement.
 * - Erreur affichée dans le formulaire : cases vidées, focus remis, secousse.
 * - Pas de « Renvoyer le code » : un TOTP est généré par l'application de
 *   l'utilisateur, rien n'est envoyé.
 */
export function OtpStep({ verifyOtp, onVerified, onCancel, email }: OtpStepProps) {
    const [code, setCode] = useState("")
    const [status, setStatus] = useState<Status>("idle")
    const [error, setError] = useState<string | null>(null)
    // Incrémenté à chaque erreur : remonter le conteneur rejoue la secousse.
    const [attempt, setAttempt] = useState(0)
    const [cancelling, setCancelling] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)
    const inFlightRef = useRef(false)
    const errorId = useId()
    const { setMood, hop } = useAuthMood()

    useEffect(() => {
        if (status === "verifying") setMood("busy")
        else if (status === "success") setMood("success")
    }, [status, setMood])

    useEffect(() => {
        if (attempt > 0) setMood("error")
    }, [attempt, setMood])

    const submit = async (value: string) => {
        if (value.length !== CODE_LENGTH || inFlightRef.current) return
        inFlightRef.current = true
        setStatus("verifying")
        setError(null)

        try {
            const result = await verifyOtp(value)
            if (result.error) {
                setError(result.error)
                setStatus("idle")
                setCode("")
                setAttempt((n) => n + 1)
                // Après le re-rendu qui réactive le champ.
                requestAnimationFrame(() => inputRef.current?.focus())
                return
            }
            setStatus("success")
            onVerified?.()
        } finally {
            inFlightRef.current = false
        }
    }

    const handleCancel = async () => {
        if (!onCancel) return
        setCancelling(true)
        try {
            await onCancel()
        } finally {
            setCancelling(false)
        }
    }

    const busy = status !== "idle"
    const slotClass = cn(
        "h-12 w-10 text-lg font-medium sm:w-12",
        error && "border-destructive"
    )

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault()
                void submit(code)
            }}
            className="space-y-5"
            noValidate
        >
            {email && (
                <p className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                    <Smartphone className="size-4 shrink-0" aria-hidden />
                    <span className="min-w-0 truncate">
                        Compte <span className="font-medium text-foreground">{email}</span>
                    </span>
                </p>
            )}

            <div
                key={attempt}
                className={cn("flex justify-center", attempt > 0 && "animate-shake")}
            >
                <InputOTP
                    ref={inputRef}
                    maxLength={CODE_LENGTH}
                    pattern={REGEXP_ONLY_DIGITS}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    data-autofocus
                    value={code}
                    onChange={(value) => {
                        // Un chiffre de plus → une lettre saute.
                        if (value.length > code.length) hop()
                        setCode(value)
                        if (error) setError(null)
                    }}
                    onComplete={(value: string) => void submit(value)}
                    disabled={busy}
                    aria-label="Code de vérification à 6 chiffres"
                    aria-invalid={!!error}
                    aria-describedby={error ? errorId : undefined}
                    containerClassName="gap-2 sm:gap-3"
                >
                    <InputOTPGroup>
                        {FIRST_GROUP.map((key, i) => (
                            <InputOTPSlot key={key} index={i} masked={false} className={slotClass} />
                        ))}
                    </InputOTPGroup>
                    <InputOTPSeparator className="hidden text-muted-foreground sm:block" />
                    <InputOTPGroup>
                        {SECOND_GROUP.map((key, i) => (
                            <InputOTPSlot
                                key={key}
                                index={i + FIRST_GROUP.length}
                                masked={false}
                                className={slotClass}
                            />
                        ))}
                    </InputOTPGroup>
                </InputOTP>
            </div>

            {error && (
                <Alert variant="destructive" id={errorId} className="animate-in fade-in duration-base">
                    <AlertCircle className="size-4" aria-hidden />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            <Button
                type="submit"
                className="h-11 w-full"
                loading={status === "verifying"}
                disabled={code.length !== CODE_LENGTH || status === "success"}
            >
                {status === "success" ? (
                    <>
                        <Check aria-hidden />
                        Code validé
                    </>
                ) : status === "verifying" ? (
                    "Vérification…"
                ) : (
                    "Valider le code"
                )}
            </Button>

            <p className="text-center text-xs text-muted-foreground text-pretty">
                Le code change toutes les 30 secondes dans votre application
                d'authentification (Google Authenticator, 1Password, Authy…).
            </p>

            {onCancel && (
                <Button
                    type="button"
                    variant="ghost"
                    className="h-11 w-full text-muted-foreground"
                    onClick={handleCancel}
                    loading={cancelling}
                    disabled={busy}
                >
                    {!cancelling && <ArrowLeft aria-hidden />}
                    Utiliser un autre compte
                </Button>
            )}
        </form>
    )
}
