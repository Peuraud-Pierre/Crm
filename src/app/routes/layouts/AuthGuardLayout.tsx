import { Suspense, lazy, useEffect } from "react"
import { Navigate, Outlet, useMatches } from "react-router"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { useMfaEnrolled } from "@/features/auth/hooks/useMfaEnrolled"
import { MfaRequiredGuard } from "@/features/auth/components/MfaRequiredGuard"
import { authOutro } from "@/features/auth/components/outro/outroStore"
import { useMaintenanceContext } from "@/features/maintenance"
import { MainLayout } from "@/shared/components/layout/MainLayout"
import { FullPageFallback, RouteFallback } from "@/shared/ui/molecules/route-fallback"

const MaintenanceScreen = lazy(() =>
    import("@/features/maintenance/components/MaintenanceScreen").then((m) => ({
        default: m.MaintenanceScreen,
    }))
)
const NotFound = lazy(() => import("@/features/notfound/routes/NotFound"))

export function AuthGuardLayout() {
    const { user, loading, permissionsLoaded, requiresMfa, hasPermission } = useAuth()
    const { state: maintenance, isFeatureDown, canBypass } = useMaintenanceContext()
    const matches = useMatches()
    const { enrolled: mfaEnrolled, loading: mfaLoading } = useMfaEnrolled(
        user?.user_id
    )

    // Fin de l'outro de connexion : la route est chargée (le routeur ne
    // monte ce layout qu'une fois son code récupéré) et les permissions,
    // qui conditionnent l'affichage de la page, sont arrivées.
    const appShown = !loading && !!user && !requiresMfa && permissionsLoaded
    useEffect(() => {
        if (appShown) authOutro.markReady()
    }, [appShown])

    if (loading) {
        return <FullPageFallback />
    }

    if (requiresMfa || !user) {
        return <Navigate to="/login" replace />
    }

    // Maintenance globale : toute l'application est coupée. Le
    // contournement passe désormais par la permission maintenance.bypass
    // et non plus par une comparaison sur le libellé du rôle — c'était le
    // seul gate par chaîne de caractères de l'application (renommer le
    // rôle « Super Admin » l'aurait silencieusement ouvert à tous).
    if (maintenance.global?.active && !canBypass) {
        return (
            <MainLayout>
                <Suspense fallback={<RouteFallback />}>
                    <MaintenanceScreen window={maintenance.global} />
                </Suspense>
            </MainLayout>
        )
    }

    const currentMatch = matches[matches.length - 1]
    const handle = currentMatch?.handle as
        | {
              permissionCode?: string | string[]
              requireMfa?: boolean
              featureKey?: string
          }
        | undefined

    // Maintenance ciblée : seule la feature de la route active est coupée,
    // le reste de l'application continue de fonctionner. `featureKey`
    // reprend le `title` de l'entrée menuItems correspondante.
    const featureKey = handle?.featureKey
    if (featureKey && isFeatureDown(featureKey) && !canBypass) {
        return (
            <MainLayout>
                <Suspense fallback={<RouteFallback />}>
                    <MaintenanceScreen
                        window={maintenance.byFeature[featureKey]}
                    />
                </Suspense>
            </MainLayout>
        )
    }
    // Tableau = « au moins un des codes » (ex. page Administration fusionnée)
    const permissionCodes = handle?.permissionCode
        ? Array.isArray(handle.permissionCode)
            ? handle.permissionCode
            : [handle.permissionCode]
        : []
    const requireMfa = handle?.requireMfa === true

    if (permissionCodes.length > 0 && !permissionsLoaded) {
        return (
            <MainLayout>
                <RouteFallback />
            </MainLayout>
        )
    }

    if (permissionCodes.length > 0 && !permissionCodes.some(hasPermission)) {
        return (
            <MainLayout>
                <Suspense fallback={<RouteFallback />}>
                    <NotFound />
                </Suspense>
            </MainLayout>
        )
    }

    if (requireMfa) {
        if (mfaLoading || mfaEnrolled === null) {
            return (
                <MainLayout>
                    <RouteFallback />
                </MainLayout>
            )
        }
        if (!mfaEnrolled) {
            return (
                <MainLayout>
                    <MfaRequiredGuard />
                </MainLayout>
            )
        }
    }

    return (
        <MainLayout>
            <Suspense fallback={<RouteFallback />}>
                <Outlet />
            </Suspense>
        </MainLayout>
    )
}
