import { Navigate } from "react-router"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"

export function RootRedirect() {
    const { allowedRoutes } = useAuth()
    return <Navigate to={allowedRoutes[0]?.href ?? "/dashboard"} replace />
}
