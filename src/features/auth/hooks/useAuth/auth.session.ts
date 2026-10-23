// src/hooks/useAuth/auth.session.ts
import {
    getAuthenticatorAssuranceLevel,
    getSession,
    listMfaFactors,
    onAuthStateChange,
} from "@/features/auth/services/authService"
import { fetchUserProfile } from "./auth.profile"
import { type Session, type AuthChangeEvent, type Factor } from "@supabase/supabase-js"
import type { AppUser } from "./types"

// Charge la session actuelle
export async function loadSession() {
    const { data } = await getSession()
    return data.session
}

// Fusion session + profil
export async function syncSessionWithProfile(session: Session | null) {
    if (!session?.user) return null
    const profile = await fetchUserProfile(session.user.id)

    // `status` porte la présence (active/inactive), pas l'état du compte : la
    // ligne lue ici est encore celle laissée par la session PRÉCÉDENTE, donc
    // « inactive » depuis que la fermeture d'onglet l'écrit réellement (cf.
    // auth.status.ts). setupPresenceListeners la repasse à « active » dans la
    // foulée ; on aligne la copie locale sur cette écriture, sans quoi le
    // Profil affiche « Statut du compte : Inactif » à quelqu'un de connecté.
    return { ...session.user, ...profile, status: "active" } as AppUser
}

/* ==================================================
   MFA-aware Auth Event Listener (SIGNED_IN, MFA, etc.)
=================================================== */
export function subscribeToAuthEvents(
    updateSession: (session: Session | null) => void,
    updateUser: (user: AppUser) => void,
    getRequiresMfa: () => boolean,
    setRequiresMfa: (value: boolean) => void
) {
    async function handleAuthEvent(
        event: AuthChangeEvent,
        session: Session | null
    ) {
        // Cas SIGNED_IN / MFA_CHALLENGE_VERIFIED / TOKEN_REFRESHED
        // On vérifie le niveau AAL
        let currentLevel = "aal1"
        if (session) {
            const { data: mfaData } =
                await getAuthenticatorAssuranceLevel()
            currentLevel = mfaData?.currentLevel || "aal1"
        }

        // Si on attend le MFA (requiresMfa = true)
        if (getRequiresMfa()) {
            // On ne laisse passer QUE si on est passé en AAL2
            if (currentLevel === "aal2") {
                // C'est bon, le MFA vient d'être validé
                setRequiresMfa(false)
            } else {
                return
            }
        } else {
            // Si on n'attend pas de MFA, on vérifie si on DEVRAIT l'attendre
            // (ex: connexion fraîche OU rechargement de page en AAL1 alors que
            // le user a un TOTP). Supabase émet SIGNED_IN à la connexion mais
            // INITIAL_SESSION au rechargement et TOKEN_REFRESHED au refresh de
            // token : tous doivent passer par ce garde, sinon on hydrate `user`
            // en AAL1 → boucle de redirection entre AuthGuardLayout et
            // PublicOnlyLayout (throttle "Too many calls to History API").
            const mfaRelevantEvent =
                event === "SIGNED_IN" ||
                event === "INITIAL_SESSION" ||
                event === "TOKEN_REFRESHED"
            if (mfaRelevantEvent && session && currentLevel === "aal1") {
                const { data: factorsData } =
                    await listMfaFactors()
                const hasTotp =
                    factorsData?.all?.some(
                        (f: Factor) =>
                            f.factor_type === "totp" && f.status === "verified"
                    ) ?? false

                if (hasTotp) {
                    setRequiresMfa(true)
                    // On ne met PAS à jour la session tout de suite pour ne pas débloquer l'UI
                    // Le LoginFlow va réagir à requiresMfa=true
                    return
                }
            }
        }

        updateSession(session)

        if (session?.user) {
            const full = await syncSessionWithProfile(session)
            updateUser(full)
        } else {
            updateUser(null)
        }
    }

    const {
        data: { subscription },
    } = onAuthStateChange((event, session) => {
        void handleAuthEvent(event, session)
    })

    return () => subscription.unsubscribe()
}

/* ==================================================
   Contrôle MFA au chargement de la session
=================================================== */
export async function validateMfaBeforeLogin(
    session: Session | null,
    requiresMfa: boolean,
    setRequiresMfa: (value: boolean) => void,
    applySession: (session: Session | null) => void,
    applyUser: (user: AppUser) => void
) {
    // Pas de session → utilisateur non connecté
    if (!session) {
        applySession(null)
        applyUser(null)
        return
    }

    // Si on est en cours de processus MFA (ex: juste après le password),
    // on ne doit PAS déconnecter l'utilisateur même s'il est AAL1.
    if (requiresMfa) {
        // On ne fait rien, on laisse l'utilisateur saisir son code
        return
    }

    try {
        // Liste des facteurs existants
        const { data: factorsData, error: factorsError } =
            await listMfaFactors()
        if (factorsError) {
            console.error("Erreur listFactors:", factorsError)
            applySession(null)
            applyUser(null)
            return
        }

        const hasTotp =
            factorsData?.all?.some(
                (f: Factor) => f.factor_type === "totp" && f.status === "verified"
            ) ?? false

        // Le user A un TOTP → exiger AAL2
        const { data: mfaData, error: aalError } =
            await getAuthenticatorAssuranceLevel()

        if (aalError) {
            applySession(null)
            applyUser(null)
            return
        }

        if (!hasTotp) {
            // AAL1 acceptable → login direct
            applySession(session)
            const u = await syncSessionWithProfile(session)
            applyUser(u)
            return
        }

        if (mfaData?.currentLevel === "aal2") {
            // Tout est ok
            applySession(session)
            const u = await syncSessionWithProfile(session)
            applyUser(u)
            return
        }

        // MFA non validé (AAL1) MAIS user a TOTP → on demande le MFA
        console.log(
            "🔐 MFA requis (AAL1 détecté au chargement) → setRequiresMfa(true)"
        )
        setRequiresMfa(true)
        // On ne déconnecte PAS, on laisse la session AAL1 active en attendant le AAL2
        // On n'applique pas la session dans le contexte pour ne pas montrer l'app
        // (ou on l'applique mais requiresMfa bloquera la nav)
        // Ici on choisit de ne PAS appliquer pour que le loader/login reste
        // Mais attention : si on n'applique pas, AuthProvider reste en loading ?
        // Non, AuthProvider met loading=false après validateMfaBeforeLogin.

        // Si on n'applique pas la session, user=null.
        // Le LoginFlow verra !user et requiresMfa=true ?
        // LoginFlow utilise requiresMfa du contexte.

        // Pour que le LoginFlow affiche l'input OTP, il faut qu'il soit monté.
        // Si user est null, on est redirigé vers /auth ?
        // AuthProvider :
        // const [user, setUser] = useState<AppUser>(null)
        // ...
        // await validateMfaBeforeLogin(...)
        // setLoading(false)

        // Si user est null, les routes protégées redirigent vers /auth/login.
        // LoginFlow est sur /auth/login.
        // Donc c'est bon.
    } catch (err) {
        console.error("Erreur MFA au chargement:", err)
        applySession(null)
        applyUser(null)
    }
}
