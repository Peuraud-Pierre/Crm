import { Suspense, useEffect, useState } from "react"
import { Navigate, Outlet } from "react-router"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { AuthShell } from "@/features/auth/components/shell/AuthShell"
import { OutroHandoff } from "@/features/auth/components/outro/OutroHandoff"
import { authOutro, useAuthOutro } from "@/features/auth/components/outro/outroStore"
import { RouteFallback } from "@/shared/ui/molecules/route-fallback"

/**
 * Même seuil que `route-fallback` : en dessous de 150 ms, l'attente n'est pas
 * perçue et l'afficher ne produirait qu'un flash. Ici c'est aussi ce qui
 * laisse l'intro de l'écran de connexion (logo, citation, tapis) se jouer en
 * entier au lieu d'être coupée par l'écran d'attente.
 */
const PENDING_DELAY_MS = 150

function useDelayed(active: boolean) {
    const [shown, setShown] = useState(false)
    useEffect(() => {
        if (!active) return
        const id = setTimeout(() => setShown(true), PENDING_DELAY_MS)
        return () => clearTimeout(id)
    }, [active])
    return active && shown
}

export function PublicOnlyLayout() {
    const { user, loading, requiresMfa } = useAuth()
    const showPending = useDelayed(loading)
    const outro = useAuthOutro()

    // Même cadre que l'écran de connexion qui suit, logo en boucle : la
    // vérification de session s'enchaîne sur le formulaire sans flash d'un
    // écran de chargement générique.
    if (loading) {
        if (!showPending) return null
        return (
            <AuthShell
                pending
                stepKey="session"
                title="La Console"
                description="Vérification de votre session…"
            />
        )
    }

    // Invariant anti-boucle : tant que le MFA est en attente, on reste sur la
    // page publique (saisie OTP) même si `user` est transitoirement truthy.
    // Sans ce garde, un état user && requiresMfa fait osciller cette redirection
    // avec celle d'AuthGuardLayout (throttle "Too many calls to History API").
    if (user && !requiresMfa) {
        // Connexion à l'instant (et non session restaurée) : l'écran de
        // connexion reste affiché le temps que l'outro reprenne le logo,
        // c'est elle qui navigue (OutroHandoff).
        if (authOutro.isArmed() || outro.phase !== "idle") {
            return (
                <>
                    <Suspense fallback={<RouteFallback scope="panel" />}>
                        <Outlet />
                    </Suspense>
                    <OutroHandoff to="/dashboard" />
                </>
            )
        }
        return <Navigate to="/dashboard" replace />
    }

    return (
        <Suspense fallback={<RouteFallback scope="panel" />}>
            <Outlet />
        </Suspense>
    )
}

export function PublicLayout() {
    return (
        <Suspense fallback={<RouteFallback scope="panel" />}>
            <Outlet />
        </Suspense>
    )
}
