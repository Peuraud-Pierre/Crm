import { useCallback, useEffect, useRef, useState } from "react"
import { Shield, AlertCircle } from "lucide-react"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/shared/ui/molecules/input-otp"
import { LoadingSpinner } from "@/shared/ui/atoms/loading-spinner"


const OTP_SLOT_KEYS = ["s0", "s1", "s2", "s3", "s4", "s5"] as const

type Props = {
    onSetup: (pin: string) => Promise<boolean>
    setupError: string | null
    setupInProgress: boolean
}

export function PinSetupScreen({ onSetup, setupError, setupInProgress }: Props) {
    const [pin, setPin] = useState("")
    const [confirmPin, setConfirmPin] = useState("")
    const [step, setStep] = useState<"enter" | "confirm">("enter")
    const [mismatchError, setMismatchError] = useState(false)
    const submittedRef = useRef(false)

    // Auto-submit when 6 digits are entered in first step
    useEffect(() => {
        if (step !== "enter" || pin.length !== 6 || submittedRef.current) return
        submittedRef.current = true
        // Move to confirmation step
        const timer = window.setTimeout(() => {
            setStep("confirm")
            submittedRef.current = false
        }, 300)
        return () => window.clearTimeout(timer)
    }, [pin, step])

    // Auto-submit when 6 digits are entered in confirm step
    useEffect(() => {
        if (
            step !== "confirm" ||
            confirmPin.length !== 6 ||
            submittedRef.current ||
            setupInProgress
        )
            return

        submittedRef.current = true
        let resetTimer: number | undefined

        // Verify pins match
        if (pin !== confirmPin) {
            // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- validation feedback on derived 6-digit input
            setMismatchError(true)
            resetTimer = window.setTimeout(() => {
                setMismatchError(false)
                setPin("")
                setConfirmPin("")
                setStep("enter")
                submittedRef.current = false
            }, 700)
            return () => window.clearTimeout(resetTimer)
        }

        // Pins match, proceed with setup
        void onSetup(pin).then((ok) => {
            if (!ok) {
                // Setup failed, reset
                resetTimer = window.setTimeout(() => {
                    setPin("")
                    setConfirmPin("")
                    setStep("enter")
                    submittedRef.current = false
                }, 700)
            }
        })
        return () => window.clearTimeout(resetTimer)
    }, [confirmPin, onSetup, pin, setupInProgress, step])

    // Reset submitted ref when inputs change
    useEffect(() => {
        if (pin.length < 6) submittedRef.current = false
    }, [pin])

    useEffect(() => {
        if (confirmPin.length < 6) submittedRef.current = false
    }, [confirmPin])

    const handleBack = useCallback(() => {
        if (step === "confirm" && !setupInProgress) {
            setConfirmPin("")
            setStep("enter")
            setMismatchError(false)
        }
    }, [setupInProgress, step])

    return (
        <div className="flex flex-1 flex-col items-center justify-center bg-gradient-to-b from-background to-muted/30 px-6">
            {/* Shield icon */}
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                <Shield className="h-10 w-10 text-primary" />
            </div>

            {/* Title */}
            <h2 className="text-xl font-semibold text-foreground">
                Configuration de la messagerie chiffrée
            </h2>
            <p className="mt-2 text-center text-sm text-muted-foreground">
                {step === "enter"
                    ? "Choisis un code PIN à 6 chiffres"
                    : "Confirme ton code PIN"}
            </p>

            {/* PIN Input */}
            <div className="mt-8">
                {setupInProgress ? (
                    <div className="flex h-12 items-center justify-center">
                        <LoadingSpinner size="md" />
                        <span className="ml-3 text-sm text-muted-foreground">
                            Configuration en cours...
                        </span>
                    </div>
                ) : (
                    <div
                        className={
                            mismatchError || setupError ? "animate-shake" : ""
                        }
                    >
                        <InputOTP
                            maxLength={6}
                            value={step === "enter" ? pin : confirmPin}
                            onChange={
                                step === "enter" ? setPin : setConfirmPin
                            }
                            autoFocus
                        >
                            <InputOTPGroup>
                                {OTP_SLOT_KEYS.map((slotKey, i) => (
                                    <InputOTPSlot
                                        key={slotKey}
                                        index={i}
                                        className={
                                            mismatchError || setupError
                                                ? "border-destructive text-destructive ring-destructive"
                                                : ""
                                        }
                                    />
                                ))}
                            </InputOTPGroup>
                        </InputOTP>
                    </div>
                )}
            </div>

            {/* Error message */}
            {mismatchError ? (
                <div className="mt-3 flex items-center gap-2 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    <span>Les codes PIN ne correspondent pas</span>
                </div>
            ) : setupError ? (
                <div className="mt-3 flex items-center gap-2 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    <span>{setupError}</span>
                </div>
            ) : null}

            {/* Back button */}
            {step === "confirm" && !setupInProgress ? (
                <button
                    type="button"
                    onClick={handleBack}
                    className="mt-6 text-sm text-muted-foreground transition hover:text-foreground"
                >
                    ← Modifier le code PIN
                </button>
            ) : null}

            {/* Hint */}
            <div className="mt-8 max-w-md rounded-lg border border-primary/20 bg-primary/5 p-4">
                <p className="text-center text-xs text-muted-foreground">
                    <strong className="text-foreground">Important :</strong> Ce
                    code PIN protège tes messages chiffrés. Tu devras le saisir
                    sur tous tes appareils. Ne le partage jamais.
                </p>
            </div>
        </div>
    )
}
