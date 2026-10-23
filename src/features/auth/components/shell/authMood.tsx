import { createContext, use, useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"

/**
 * Humeur du logo vivant des écrans d'auth : les formulaires signalent ce qui
 * se passe (frappe, champ secret, attente, erreur, succès) et le logo y
 * répond. C'est ce qui fait de l'écran une interface et non un décor : le
 * mouvement répond toujours à un geste de l'utilisateur.
 *
 * - `idle`    : lettres en suspension, suivent le pointeur.
 * - `secret`  : champ mot de passe actif, les lettres se font discrètes.
 * - `busy`    : vague qui parcourt le mot (requête en cours).
 * - `error`   : secousse, puis retour automatique à `idle`.
 * - `success` : les lettres sautent ensemble et se figent.
 */
export type AuthMood = "idle" | "secret" | "busy" | "error" | "success"

/** Durée de la secousse d'erreur avant le retour au repos. */
const ERROR_MS = 700

interface AuthMoodValue {
    mood: AuthMood
    /** Nombre de frappes depuis le montage : chaque frappe fait sauter une lettre. */
    hops: number
    setMood: (mood: AuthMood) => void
    hop: () => void
}

const NOOP: AuthMoodValue = { mood: "idle", hops: 0, setMood: () => {}, hop: () => {} }

const AuthMoodContext = createContext<AuthMoodValue>(NOOP)

export function AuthMoodProvider({
    initial = "idle",
    children,
}: {
    initial?: AuthMood
    children: ReactNode
}) {
    const [currentMood, setCurrentMood] = useState<AuthMood>(initial)
    const [hops, setHops] = useState(0)
    const errorTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

    useEffect(() => () => clearTimeout(errorTimerRef.current), [])

    // Stables : les formulaires les appellent depuis leurs effets.
    const setMood = useCallback((next: AuthMood) => {
        clearTimeout(errorTimerRef.current)
        setCurrentMood(next)
        if (next === "error") {
            errorTimerRef.current = setTimeout(() => setCurrentMood("idle"), ERROR_MS)
        }
    }, [])
    const hop = useCallback(() => setHops((n) => n + 1), [])

    const value = useMemo<AuthMoodValue>(
        () => ({ mood: currentMood, hops, setMood, hop }),
        [currentMood, hops, setMood, hop]
    )

    return <AuthMoodContext value={value}>{children}</AuthMoodContext>
}

/**
 * Hors d'un AuthShell (tests de formulaires isolés), renvoie des fonctions
 * sans effet : un formulaire n'a jamais à savoir s'il est mis en scène.
 */
export function useAuthMood(): AuthMoodValue {
    return use(AuthMoodContext)
}

/**
 * Pont pour les écrans qui rendent eux-mêmes leur AuthShell : leur état vit
 * au-dessus du fournisseur, ils ne peuvent pas appeler `useAuthMood`. Posé
 * dans les enfants de l'AuthShell, il relaie :
 * - `mood` quand il change ou quand `trigger` change (nouvel échec) ;
 * - un saut de lettre chaque fois que `typed` augmente (frappe).
 */
export function MoodSignal({
    mood,
    trigger,
    typed = 0,
}: {
    mood: AuthMood | null
    trigger?: unknown
    typed?: number
}) {
    const { setMood, hop } = useAuthMood()
    const typedRef = useRef(typed)

    useEffect(() => {
        if (mood) setMood(mood)
    }, [mood, trigger, setMood])

    useEffect(() => {
        if (typed > typedRef.current) hop()
        typedRef.current = typed
    }, [typed, hop])

    return null
}
