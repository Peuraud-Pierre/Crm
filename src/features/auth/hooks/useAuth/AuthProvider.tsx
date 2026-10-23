// src/hooks/useAuth/AuthProvider.tsx
import React from "react"
import { menuItems } from "@/shared/components/layout/menuItems"
import { fetchPermissions } from "@/shared/components/misc/Permission"
import type { Session } from "@supabase/supabase-js"
import {
    createContext,
    use,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react"

import { initErrorLogger, resetErrorLogger } from "@/shared/lib/errorLogger"
import { rememberFirstName } from "@/features/auth/utils/rememberedAccount"
import { changePassword, signIn, signOutAction, signUp } from "./auth.actions"
import { verifyOtp as verifyOtpRaw } from "./auth.mfa"
import {
    loadSession,
    subscribeToAuthEvents,
    validateMfaBeforeLogin,
} from "./auth.session"
import { setupInactivityLogout } from "./auth.inactivity"
import { setupPresenceListeners } from "./auth.status"
import type { AppUser, AuthContextType } from "./types"

export const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<AppUser>(null)
    const [session, setSession] = useState<Session | null>(null)
    const [loading, setLoading] = useState(true)
    // setRequiresMfa (alias exposé) encapsule ce setter + le ref ; nom interne dérogatoire.
    // eslint-disable-next-line react-naming-convention/use-state
    const [requiresMfa, setRequiresMfaState] = useState(false)
    const requiresMfaRef = useRef(false)
    const [allowedRoutes, setAllowedRoutes] = useState(menuItems)
    const [permissions, setPermissions] = useState<Set<string>>(() => new Set())
    const [permissionsLoaded, setPermissionsLoaded] = useState(false)

    const setRequiresMfa = (value: boolean) => {
        requiresMfaRef.current = value
        setRequiresMfaState(value)
    }

    const userId = user?.user_id
    const dbId = user?.id

    useEffect(() => {
        if (!userId || !dbId) {
            // Reset contrôlé des permissions sur changement d'entité (user déconnecté).
            // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
            setPermissionsLoaded(false)
            return
        }

        const load = async () => {
            const { codes, allowedRoutes: routes } = await fetchPermissions(userId)
            setPermissions(codes)
            setAllowedRoutes(routes)
            setPermissionsLoaded(true)
        }
        load()
    }, [userId, dbId])

    useEffect(() => {
        async function init() {
            const s = await loadSession()

            await validateMfaBeforeLogin(
                s,
                requiresMfaRef.current,
                setRequiresMfa,
                setSession,
                setUser
            )

            setLoading(false)
        }
        init()

        return subscribeToAuthEvents(
            setSession,
            setUser,
            () => requiresMfaRef.current,
            setRequiresMfa
        )
    }, [])

    useEffect(() => {
        const authId = user?.id
        if (!authId) return
        return setupPresenceListeners(authId)
    }, [user?.id])

    useEffect(() => {
        if (!user?.id) return
        return setupInactivityLogout()
    }, [user?.id])

    useEffect(() => {
        if (user?.user_id) {
            initErrorLogger(user.user_id, user.email)
        } else {
            resetErrorLogger()
        }
    }, [user?.user_id, user?.email])

    // Prénom pour l'accueil de l'écran de connexion à la prochaine visite.
    useEffect(() => {
        rememberFirstName(user?.full_name)
    }, [user?.full_name])

    const hasPermission = useCallback(
        (code: string) => permissions.has(code.toLowerCase()),
        [permissions]
    )

    const verifyOtp = useCallback(async (code: string) => {
        const result = await verifyOtpRaw(code)
        return {
            user: (result.user ?? null) as AppUser,
            error: result.error ?? null,
            code: result.code,
        }
    }, [])

    const values = useMemo(() => {
        return {
            user,
            session,
            loading,
            permissionsLoaded,
            signIn,
            signUp,
            signOut: signOutAction,
            changePassword,
            verifyOtp,
            setUser,
            setRequiresMfa,
            requiresMfa,
            allowedRoutes,
            hasPermission,
        }
    }, [user, session, loading, permissionsLoaded, requiresMfa, allowedRoutes, hasPermission, verifyOtp])

    return (
        <AuthContext value={values}>{children}</AuthContext>
    )
}

export const useAuth = (): AuthContextType => {
    const context = use(AuthContext)
    if (context === null) {
        throw new Error("useAuthContext must be used within an AuthProvider")
    }
    return context
}
