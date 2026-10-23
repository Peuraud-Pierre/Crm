import {
    createContext,
    use,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react"
import { useTheme } from "next-themes"
import { toast } from "sonner"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { useLiveRef } from "@/shared/hooks/useLiveRef"
import {
    fetchUserPreferences,
    saveUserPreferences,
} from "../../services/preferencesService"
import {
    DEFAULT_PREFERENCES,
    type ThemeChoice,
    type UserPreferences,
} from "../../types"

export type PreferencesPatch = Partial<Omit<UserPreferences, "user_id">>

export interface UserPreferencesContextValue {
    preferences: Omit<UserPreferences, "user_id">
    loading: boolean
    refetch: () => Promise<void>
    updatePreferences: (patch: PreferencesPatch) => Promise<boolean>
    setThemeChoice: (theme: ThemeChoice) => Promise<boolean>
}

const UserPreferencesContext =
    createContext<UserPreferencesContextValue | null>(null)

/**
 * Préférences de l'utilisateur courant — **source unique** pour toute
 * l'application. Persistées en base pour suivre le compte d'un appareil à
 * l'autre ; tant qu'aucune ligne n'existe, `DEFAULT_PREFERENCES` s'applique
 * et la première écriture crée la ligne (upsert).
 *
 * Pourquoi un provider et pas un simple hook : le réglage du thème a deux
 * points de commande (le bouton de la barre supérieure et l'écran
 * Paramètres). Deux instances d'un même hook donnaient deux états
 * concurrents — l'un des deux affichait une valeur périmée — et deux
 * lectures en base au démarrage.
 *
 * Le thème est un cas particulier : la base fait autorité au chargement et
 * écrase le choix mémorisé localement par next-themes (`localStorage`,
 * clé `darkMode`). `setTheme` réécrit lui-même cette clé, donc le script
 * anti-FOUC (`src/theme/noFlash.ts`) reste aligné au rechargement suivant.
 */
export function UserPreferencesProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth()
    const { setTheme } = useTheme()
    const userId = user?.user_id ?? user?.id ?? null

    // `setTheme` de next-themes est un useCallback dépendant du thème
    // courant : son identité change à CHAQUE changement de thème. Le mettre
    // dans les dépendances de `refetch` faisait donc relire la base à chaque
    // bascule — et cette lecture, concurrente de l'écriture en cours,
    // rétablissait l'ancien thème. Le ref le neutralise (cf. useLiveRef).
    const setThemeRef = useLiveRef(setTheme)

    const [preferences, setPreferences] =
        useState<Omit<UserPreferences, "user_id">>(DEFAULT_PREFERENCES)
    const [loading, setLoading] = useState(true)
    // Lu par `updatePreferences` pour connaître l'état à restaurer en cas
    // d'échec, sans faire dépendre le callback de `preferences`.
    const preferencesRef = useLiveRef(preferences)
    // Dernière requête gagne, en lecture comme en écriture : une réponse
    // tardive ne doit jamais écraser un état plus récent.
    const readIdRef = useRef(0)
    const writeIdRef = useRef(0)

    const refetch = useCallback(async () => {
        if (!userId) return

        const requestId = ++readIdRef.current
        const writesBefore = writeIdRef.current
        try {
            const row = await fetchUserPreferences(userId)
            if (readIdRef.current !== requestId) return
            // Une écriture émise pendant la lecture porte l'intention la
            // plus récente : ne pas la recouvrir avec l'état lu.
            if (writeIdRef.current !== writesBefore) return

            if (row) {
                setPreferences({
                    theme: row.theme,
                    push_enabled: row.push_enabled,
                    notify_ticket: row.notify_ticket,
                    notify_message: row.notify_message,
                    notify_system: row.notify_system,
                })
                setThemeRef.current(row.theme)
            }
        } catch (err) {
            if (readIdRef.current !== requestId) return
            console.error("[UserPreferences] refetch:", err)
            toast.error("Erreur lors du chargement des préférences")
        } finally {
            if (readIdRef.current === requestId) setLoading(false)
        }
    }, [userId, setThemeRef])

    // Ne se redéclenche qu'au changement d'utilisateur.
    useEffect(() => {
        refetch()
    }, [refetch])

    /**
     * Applique le patch de façon optimiste puis persiste. En cas d'échec,
     * l'état revient à sa valeur précédente — sauf si un réglage plus
     * récent a été demandé entre-temps, auquel cas c'est lui qui fait foi.
     */
    const updatePreferences = useCallback(
        async (patch: PreferencesPatch): Promise<boolean> => {
            if (!userId) return false

            const writeId = ++writeIdRef.current
            const previous = preferencesRef.current
            setPreferences((current) => ({ ...current, ...patch }))
            if (patch.theme) setThemeRef.current(patch.theme)

            try {
                await saveUserPreferences(userId, patch)
                return true
            } catch (err) {
                console.error("[UserPreferences] updatePreferences:", err)
                if (writeIdRef.current !== writeId) return false

                toast.error("Erreur lors de l'enregistrement des préférences")
                setPreferences(previous)
                if (patch.theme) setThemeRef.current(previous.theme)
                return false
            }
        },
        [userId, setThemeRef, preferencesRef]
    )

    const setThemeChoice = useCallback(
        (theme: ThemeChoice) => updatePreferences({ theme }),
        [updatePreferences]
    )

    const value = useMemo(
        () => ({
            preferences,
            loading,
            refetch,
            updatePreferences,
            setThemeChoice,
        }),
        [preferences, loading, refetch, updatePreferences, setThemeChoice]
    )

    return (
        <UserPreferencesContext value={value}>
            {children}
        </UserPreferencesContext>
    )
}

export function useUserPreferencesContext(): UserPreferencesContextValue {
    const context = use(UserPreferencesContext)
    if (!context) {
        throw new Error(
            "useUserPreferencesContext doit être utilisé dans un UserPreferencesProvider"
        )
    }
    return context
}
