import { useEffect, useRef, useState } from "react"
import type { TurnstileHandle } from "@/features/auth/components/TurnstileField"
import type { AuthContextType } from "@/features/auth/hooks/useAuth/types"
import { authOutro } from "@/features/auth/components/outro/outroStore"
import { writeLastEmail } from "@/features/auth/utils/rememberedAccount"

/**
 * Phases du bouton de connexion :
 * - `verifying` : en attente du jeton Turnstile (invisible la plupart du temps) ;
 * - `submitting` : requête GoTrue en cours ;
 * - `success` : mot de passe accepté, on attend que le Provider bascule vers
 *   l'étape MFA ou que PublicOnlyLayout redirige. Le bouton reste occupé pour
 *   ne pas clignoter « Se connecter » une fraction de seconde.
 */
export type SignInPhase = "idle" | "verifying" | "submitting" | "success"

/**
 * Filet de sécurité de la phase `success` : si ni l'étape MFA ni la
 * redirection n'arrivent (profil introuvable, événement auth perdu), on rend
 * la main plutôt que de laisser le bouton tourner indéfiniment.
 */
const SUCCESS_STALL_MS = 15_000

interface Options {
    signIn: AuthContextType["signIn"]
    email: string
}

export function useSignInForm({ signIn, email }: Options) {
    const [password, setPassword] = useState("")
    const [phase, setPhase] = useState<SignInPhase>("idle")
    const [error, setError] = useState<string | null>(null)
    // Incrémenté à chaque échec : sert de `key` pour rejouer la secousse.
    const [attempt, setAttempt] = useState(0)
    const captchaRef = useRef<TurnstileHandle>(null)
    const passwordRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (phase !== "success") return
        const id = setTimeout(() => {
            setPhase("idle")
            setError("La connexion prend plus de temps que prévu. Réessayez.")
            captchaRef.current?.reset()
        }, SUCCESS_STALL_MS)
        return () => clearTimeout(id)
    }, [phase])

    const fail = (message: string, { clearPassword }: { clearPassword: boolean }) => {
        setError(message)
        setPhase("idle")
        setAttempt((n) => n + 1)
        // Jeton Turnstile à usage unique : GoTrue l'a consommé, même en échec.
        captchaRef.current?.reset()
        if (clearPassword) setPassword("")
        requestAnimationFrame(() => passwordRef.current?.focus())
    }

    const submit = async () => {
        if (phase !== "idle") return
        const trimmedEmail = email.trim()
        if (!trimmedEmail || !password) {
            setError("Renseignez votre email et votre mot de passe.")
            setAttempt((n) => n + 1)
            return
        }

        setError(null)
        setPhase("verifying")

        let token: string
        try {
            token = (await captchaRef.current?.getToken()) ?? ""
        } catch {
            fail(
                "La vérification de sécurité n'a pas abouti. Vérifiez votre connexion et réessayez.",
                { clearPassword: false }
            )
            return
        }

        setPhase("submitting")
        const result = await signIn(trimmedEmail, password, token)

        if (result.error) {
            fail(result.error, {
                // Mauvais identifiants : on vide pour une ressaisie propre.
                // Erreur réseau / captcha : le mot de passe était peut-être bon.
                clearPassword: result.code === "invalid_credentials",
            })
            return
        }

        writeLastEmail(trimmedEmail)
        // Mot de passe accepté : l'entrée dans l'app (directe, ou après le
        // code MFA) jouera l'outro.
        authOutro.arm()
        setPhase("success")
    }

    return {
        password,
        setPassword,
        phase,
        error,
        clearError: () => setError(null),
        attempt,
        captchaRef,
        passwordRef,
        submit,
    }
}
