import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { acceptPrivacyPolicy } from "@/shared/services/privacyService"
import { Button } from "@/shared/ui/atoms/button"
import { Checkbox } from "@/shared/ui/atoms/checkbox"
// Composition bas niveau volontaire : modale de consentement légal forcée
// ouverte et sans bouton de fermeture, non exprimable via le wrapper
// @/shared/ui/atoms/dialog (qui impose un bouton de fermeture et son propre
// portail). D'où l'accès direct aux primitives Radix ici.
// eslint-disable-next-line no-restricted-imports
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { cn } from "@/shared/lib/utils"
import { toast } from "sonner"
import { Check } from "lucide-react"
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react"
import {
    BonneConduiteContent,
    CharteInformatiqueContent,
    DonneesPersonnellesContent,
    IAContent,
    LEGAL_STEPS,
    PRIVACY_LAST_UPDATED,
    PRIVACY_VERSION,
    PRIVACY_VERSION_LABEL,
} from "./legalContent"
import type { LegalStepKey } from "./legalContent"

const SCROLL_TOLERANCE_PX = 24

const CONTENT_BY_KEY: Record<LegalStepKey, () => React.ReactElement> = {
    charte: CharteInformatiqueContent,
    donnees: DonneesPersonnellesContent,
    conduite: BonneConduiteContent,
    ia: IAContent,
}

export function PrivacyConsentDialog() {
    const { user, setUser, signOut } = useAuth()

    const needsAcceptance = useMemo(() => {
        if (!user) return false
        if (!user.privacy_accepted_at) return true
        return user.privacy_accepted_version !== PRIVACY_VERSION
    }, [user])

    // step : 0..3 = lecture des 4 volets, 4 = validation globale
    const [step, setStep] = useState(0)
    const [acceptedSteps, setAcceptedSteps] = useState<
        Record<LegalStepKey, boolean>
    >({
        charte: false,
        donnees: false,
        conduite: false,
        ia: false,
    })
    const [scrolledSteps, setScrolledSteps] = useState<
        Record<LegalStepKey, boolean>
    >({
        charte: false,
        donnees: false,
        conduite: false,
        ia: false,
    })
    const [finalChecked, setFinalChecked] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const scrollRef = useRef<HTMLDivElement>(null)

    const isReadingStep = step < LEGAL_STEPS.length
    const currentStep = isReadingStep ? LEGAL_STEPS[step] : null

    // Reset scroll en haut à chaque changement d'étape
    useEffect(() => {
        const el = scrollRef.current
        if (el) el.scrollTop = 0
    }, [step])

    const handleScroll = useCallback(() => {
        if (!currentStep) return
        const el = scrollRef.current
        if (!el) return
        const reachedBottom =
            el.scrollTop + el.clientHeight >=
            el.scrollHeight - SCROLL_TOLERANCE_PX
        if (reachedBottom) {
            setScrolledSteps((s) =>
                s[currentStep.key] ? s : { ...s, [currentStep.key]: true }
            )
        }
    }, [currentStep])

    // Si le contenu tient sans scroll, déverrouille via le handler dès
    // qu'on attache le scroll (mesure synchrone via ref callback).
    const contentRefCallback = useCallback(
        (el: HTMLDivElement | null) => {
            scrollRef.current = el
            if (!el || !currentStep) return
            if (el.scrollHeight <= el.clientHeight + SCROLL_TOLERANCE_PX) {
                setScrolledSteps((s) =>
                    s[currentStep.key]
                        ? s
                        : { ...s, [currentStep.key]: true }
                )
            }
        },
        [currentStep]
    )

    const handleAccept = useCallback(async () => {
        if (!user?.user_id) return
        setIsSubmitting(true)
        const acceptedAt = new Date().toISOString()
        try {
            await acceptPrivacyPolicy(user.user_id, PRIVACY_VERSION, acceptedAt)
        } catch (error) {
            console.error("Error saving privacy acceptance:", error)
            toast.error("Impossible d'enregistrer votre acceptation", { description: error instanceof Error ? error.message : undefined })
            setIsSubmitting(false)
            return
        }

        setUser({
            ...user,
            privacy_accepted_at: acceptedAt,
            privacy_accepted_version: PRIVACY_VERSION,
        })
        setIsSubmitting(false)
    }, [user, setUser, toast])

    const handleRefuse = useCallback(async () => {
        await signOut()
    }, [signOut])

    if (!needsAcceptance) return null

    const stepKey = currentStep?.key
    const hasScrolled = stepKey ? scrolledSteps[stepKey] : true
    const stepAccepted = stepKey ? acceptedSteps[stepKey] : false
    const allAccepted =
        acceptedSteps.charte &&
        acceptedSteps.donnees &&
        acceptedSteps.conduite &&
        acceptedSteps.ia

    // Date et heure de validation, générées automatiquement et
    // affichées à titre informatif sur l'écran de validation globale.
    const now = new Date()
    const validationDate = now.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
    })
    const validationTime = now.toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
    })

    return (
        <DialogPrimitive.Root open modal>
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay
                    className={cn(
                        // eslint-disable-next-line nokk-project/no-restricted-syntax -- scrim/overlay volontairement noir quel que soit le thème (design system §12.4)
                        "fixed inset-0 z-50 bg-black/80 backdrop-blur-sm",
                        "data-[state=open]:animate-in data-[state=closed]:animate-out",
                        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
                    )}
                />
                <DialogPrimitive.Content
                    onEscapeKeyDown={(e) => e.preventDefault()}
                    onPointerDownOutside={(e) => e.preventDefault()}
                    onInteractOutside={(e) => e.preventDefault()}
                    className={cn(
                        "fixed z-50 flex flex-col bg-background shadow-lg border",
                        "inset-0 sm:inset-auto sm:top-1/2 sm:left-1/2",
                        "sm:-translate-x-1/2 sm:-translate-y-1/2",
                        "w-full sm:w-[90vw] sm:max-w-3xl",
                        "h-full sm:h-auto sm:max-h-[90vh]",
                        "sm:rounded-lg",
                        "data-[state=open]:animate-in data-[state=closed]:animate-out",
                        "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
                        "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95"
                    )}
                >
                    <div className="p-6 border-b shrink-0 space-y-4">
                        <div>
                            <DialogPrimitive.Title className="text-lg font-semibold leading-none tracking-tight">
                                {currentStep
                                    ? currentStep.title
                                    : "Validation Globale"}
                            </DialogPrimitive.Title>
                            <DialogPrimitive.Description className="mt-2 text-sm text-muted-foreground">
                                {currentStep
                                    ? "Lisez l'intégralité du document, puis cochez la case d'acceptation pour passer à l'étape suivante."
                                    : "Confirmation et engagement."}
                            </DialogPrimitive.Description>
                        </div>
                        <Stepper step={step} accepted={acceptedSteps} />
                        <p className="text-xs text-muted-foreground">
                            Version&nbsp;{PRIVACY_VERSION} — mise à jour le{" "}
                            {PRIVACY_LAST_UPDATED}
                        </p>
                    </div>

                    {isReadingStep && currentStep ? (
                        <>
                            <div
                                ref={contentRefCallback}
                                onScroll={handleScroll}
                                className="flex-1 overflow-y-auto px-6 py-4 overscroll-contain"
                            >
                                {CONTENT_BY_KEY[currentStep.key]()}
                            </div>

                            <div className="border-t p-6 space-y-4 shrink-0 bg-background">
                                {!hasScrolled && (
                                    <p className="text-xs text-muted-foreground">
                                        Déroulez le document jusqu'au bas pour
                                        activer l'acceptation.
                                    </p>
                                )}

                                <label
                                    className={cn(
                                        "flex items-start gap-3 select-none",
                                        !hasScrolled &&
                                            "opacity-50 cursor-not-allowed"
                                    )}
                                >
                                    <Checkbox
                                        checked={stepAccepted}
                                        onCheckedChange={(v) =>
                                            setAcceptedSteps((s) => ({
                                                ...s,
                                                [currentStep.key]: v === true,
                                            }))
                                        }
                                        disabled={!hasScrolled}
                                        className="mt-0.5"
                                    />
                                    <span className="text-sm">
                                        {currentStep.checkboxLabel}
                                    </span>
                                </label>

                                <div className="flex flex-col-reverse sm:flex-row sm:justify-between sm:gap-2 gap-2">
                                    <Button
                                        variant="ghost"
                                        onClick={handleRefuse}
                                        disabled={isSubmitting}
                                    >
                                        Refuser et se déconnecter
                                    </Button>
                                    <div className="flex gap-2 sm:justify-end">
                                        {step > 0 && (
                                            <Button
                                                variant="outline"
                                                onClick={() =>
                                                    setStep((s) => s - 1)
                                                }
                                                disabled={isSubmitting}
                                            >
                                                Précédent
                                            </Button>
                                        )}
                                        <Button
                                            onClick={() => setStep((s) => s + 1)}
                                            disabled={
                                                !hasScrolled || !stepAccepted
                                            }
                                        >
                                            Suivant
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="flex-1 overflow-y-auto px-6 py-4">
                                <div className="space-y-4 text-sm">
                                    <p>
                                        Je,{" "}
                                        <strong>
                                            {user?.full_name?.trim() ||
                                                "[PRÉNOM NOM]"}
                                        </strong>
                                        , certifie avoir pris connaissance des
                                        quatre volets précédents régissant
                                        l'utilisation de La Console
                                        NOKK_PROJECT&nbsp;:
                                    </p>
                                    <ul className="space-y-2">
                                        {LEGAL_STEPS.map((s) => (
                                            <li
                                                key={s.key}
                                                className="flex items-start gap-3 rounded-md border p-3"
                                            >
                                                <span
                                                    className={cn(
                                                        "mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full",
                                                        acceptedSteps[s.key]
                                                            ? "bg-emerald-500/15 text-emerald-600"
                                                            : "bg-muted text-muted-foreground"
                                                    )}
                                                >
                                                    <Check className="h-3.5 w-3.5" />
                                                </span>
                                                <div>
                                                    <p className="font-medium">
                                                        {s.title}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        Acceptée à l'étape{" "}
                                                        {LEGAL_STEPS.findIndex(
                                                            (x) =>
                                                                x.key === s.key
                                                        ) + 1}
                                                        .
                                                    </p>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                    <p>
                                        Je comprends que cette validation vaut
                                        acceptation des conditions d'utilisation
                                        et que tout manquement pourra entraîner
                                        la suspension immédiate de mes accès
                                        et/ou des sanctions disciplinaires
                                        conformément au Règlement Intérieur et au
                                        droit du travail en vigueur.
                                    </p>
                                    <p>
                                        Les documents de référence complets
                                        (Charte Informatique, Politique de
                                        Protection des Données, Règlement
                                        Intérieur) restent disponibles à tout
                                        moment sur simple demande auprès du
                                        service RH.
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        Validation enregistrée le{" "}
                                        {validationDate} à {validationTime}
                                        <br />
                                        Version des conditions&nbsp;:{" "}
                                        {PRIVACY_VERSION_LABEL}
                                    </p>
                                </div>
                            </div>

                            <div className="border-t p-6 space-y-4 shrink-0 bg-background">
                                <label className="flex items-start gap-3 select-none">
                                    <Checkbox
                                        checked={finalChecked}
                                        onCheckedChange={(v) =>
                                            setFinalChecked(v === true)
                                        }
                                        className="mt-0.5"
                                    />
                                    <span className="text-sm">
                                        Je valide l'ensemble des conditions et
                                        j'accède à La Console NOKK_PROJECT.
                                    </span>
                                </label>

                                <div className="flex flex-col-reverse sm:flex-row sm:justify-between sm:gap-2 gap-2">
                                    <Button
                                        variant="ghost"
                                        onClick={handleRefuse}
                                        disabled={isSubmitting}
                                    >
                                        Refuser et se déconnecter
                                    </Button>
                                    <div className="flex gap-2 sm:justify-end">
                                        <Button
                                            variant="outline"
                                            onClick={() =>
                                                setStep(LEGAL_STEPS.length - 1)
                                            }
                                            disabled={isSubmitting}
                                        >
                                            Précédent
                                        </Button>
                                        <Button
                                            onClick={handleAccept}
                                            disabled={
                                                !allAccepted ||
                                                !finalChecked ||
                                                isSubmitting
                                            }
                                        >
                                            {isSubmitting
                                                ? "Enregistrement…"
                                                : "Je valide et j'accède"}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    )
}

function Stepper({
    step,
    accepted,
}: {
    step: number
    accepted: Record<LegalStepKey, boolean>
}) {
    const totalSteps = LEGAL_STEPS.length + 1
    return (
        <ol className="flex items-center gap-2">
            {Array.from({ length: totalSteps }).map((_, idx) => {
                const isCurrent = idx === step
                const isReading = idx < LEGAL_STEPS.length
                const isDone = isReading
                    ? accepted[LEGAL_STEPS[idx].key]
                    : false
                const label = isReading
                    ? LEGAL_STEPS[idx].shortTitle
                    : "Validation"
                const stepId = isReading ? LEGAL_STEPS[idx].key : "final"
                return (
                    <li
                        key={stepId}
                        className="flex flex-1 items-center gap-2 min-w-0"
                    >
                        <span
                            className={cn(
                                "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium",
                                isCurrent &&
                                    "border-primary bg-primary text-primary-foreground",
                                !isCurrent &&
                                    isDone &&
                                    "border-emerald-500 bg-emerald-500/10 text-emerald-600",
                                !isCurrent &&
                                    !isDone &&
                                    "border-muted-foreground/30 text-muted-foreground"
                            )}
                        >
                            {isDone && !isCurrent ? (
                                <Check className="h-3.5 w-3.5" />
                            ) : (
                                idx + 1
                            )}
                        </span>
                        <span
                            className={cn(
                                "truncate text-xs",
                                isCurrent
                                    ? "font-medium text-foreground"
                                    : "text-muted-foreground"
                            )}
                        >
                            {label}
                        </span>
                    </li>
                )
            })}
        </ol>
    )
}
