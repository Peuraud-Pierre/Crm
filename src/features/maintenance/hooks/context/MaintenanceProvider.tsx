"use client"

import { createContext, use, type ReactNode } from "react"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { MAINTENANCE_PERMISSIONS } from "../../constants"
import { useMaintenance } from "../data/useMaintenance"

/**
 * Le contexte expose exactement la surface du hook, plus `canBypass`.
 *
 * `ReturnType<typeof useMaintenance>` plutôt qu'une interface réécrite à
 * la main : les trois providers du module Manager déclaraient chacun leur
 * propre type, et celui de la maintenance avait fini par diverger de la
 * signature réelle du hook (paramètres optionnels devenus obligatoires,
 * `error` oublié). Dériver le type supprime la classe de bug.
 */
type MaintenanceContextValue = ReturnType<typeof useMaintenance> & {
    /**
     * L'utilisateur courant peut-il traverser une maintenance ?
     *
     * Remplace la comparaison `user.role !== "Super Admin"` qui vivait
     * dans AuthGuardLayout — seul gate par libellé de rôle de
     * l'application. La permission `maintenance.bypass` a été accordée
     * aux détenteurs de `manager.maintenance` et au rôle Super Admin par
     * la migration 20260824100000, le comportement est donc préservé.
     */
    canBypass: boolean
}

const MaintenanceContext = createContext<MaintenanceContextValue | undefined>(
    undefined
)

export function MaintenanceProvider({ children }: { children: ReactNode }) {
    const maintenance = useMaintenance()
    const { hasPermission } = useAuth()

    const value: MaintenanceContextValue = {
        ...maintenance,
        canBypass: hasPermission(MAINTENANCE_PERMISSIONS.bypass),
    }

    return <MaintenanceContext value={value}>{children}</MaintenanceContext>
}

export function useMaintenanceContext() {
    const ctx = use(MaintenanceContext)
    if (!ctx) {
        throw new Error(
            "useMaintenanceContext must be used inside <MaintenanceProvider>"
        )
    }
    return ctx
}
