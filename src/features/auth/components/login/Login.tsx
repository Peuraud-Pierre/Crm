import { useState } from "react"
import { OtpStep } from "@/features/auth/components/OtpStep"
import { authOutro } from "@/features/auth/components/outro/outroStore"
import { AuthShell } from "@/features/auth/components/shell/AuthShell"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { abandonPendingSignIn } from "@/features/auth/hooks/useAuth/auth.actions"
import {
    forgetRememberedAccount,
    greeting,
    readFirstName,
    readLastEmail,
} from "@/features/auth/utils/rememberedAccount"
import SignInForm from "./SignInForm"

/**
 * Parcours de connexion en deux étapes : mot de passe, puis code TOTP si le
 * compte en a un. L'étape affichée est dictée par `requiresMfa` du Provider
 * (lui seul sait si la session est AAL1 avec un facteur vérifié) ; ce
 * composant ne fait que choisir l'écran et le sens de la transition.
 */
export function LoginFlow() {
    const { signIn, verifyOtp, requiresMfa, setRequiresMfa, setUser } = useAuth()
    const [initialEmail] = useState(readLastEmail)
    const [firstName, setFirstName] = useState(readFirstName)
    const [email, setEmail] = useState(initialEmail)
    const [direction, setDirection] = useState<"forward" | "back">("forward")

    if (requiresMfa) {
        const verify = async (code: string) => {
            const result = await verifyOtp(code)
            if (!result.error) {
                authOutro.arm()
                // Le Provider recevra aussi MFA_CHALLENGE_VERIFIED et
                // hydratera le profil complet ; on débloque sans l'attendre.
                setUser(result.user)
                setRequiresMfa(false)
            }
            return result
        }

        const cancel = async () => {
            authOutro.disarm()
            await abandonPendingSignIn()
            // Autre personne au poste : on ne l'accueille pas avec le
            // prénom ni l'email de la précédente.
            forgetRememberedAccount()
            setFirstName("")
            setEmail("")
            setRequiresMfa(false)
            setDirection("back")
        }

        return (
            <AuthShell
                stepKey="mfa"
                direction="forward"
                title="Vérification en deux étapes"
                description="Saisissez le code à 6 chiffres affiché dans votre application d'authentification."
            >
                <OtpStep verifyOtp={verify} onCancel={cancel} email={email || undefined} />
            </AuthShell>
        )
    }

    // Le prénom ne vaut que pour l'email mémorisé : quelqu'un d'autre qui
    // tape son adresse n'est pas accueilli sous le nom du précédent.
    const knownName = firstName && email.trim() === initialEmail ? firstName : ""

    return (
        <AuthShell
            stepKey="signin"
            direction={direction}
            title={knownName ? `${greeting()} ${knownName}` : greeting()}
            description={
                knownName
                    ? "Ravi de vous revoir. Il ne manque que votre mot de passe."
                    : "Connectez-vous avec votre compte NOKK_PROJECT pour retrouver La Console."
            }
        >
            <SignInForm
                signIn={signIn}
                email={email}
                onEmailChange={setEmail}
                emailPrefilled={!!initialEmail}
            />
        </AuthShell>
    )
}
