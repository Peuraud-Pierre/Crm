import { useEffect, useState } from "react"
import { toast } from "sonner"
import { listRoleOptions } from "../../services/roleService"
import { listServiceOptions } from "../../services/serviceService"
import type { EntityOption } from "../../types"

interface EntityOptions {
    roles: EntityOption[]
    services: EntityOption[]
    loading: boolean
}

/** Options rôles/services pour les selects d'assignation (onglet Utilisateurs). */
export function useEntityOptions(): EntityOptions {
    const [options, setOptions] = useState<EntityOptions>({
        roles: [],
        services: [],
        loading: true,
    })

    useEffect(() => {
        let cancelled = false
        Promise.all([listRoleOptions(), listServiceOptions()])
            .then(([roles, services]) => {
                if (!cancelled) setOptions({ roles, services, loading: false })
            })
            .catch((err) => {
                console.error("Erreur chargement rôles/services:", err)
                if (!cancelled) {
                    toast.error("Erreur lors du chargement des rôles/services")
                    setOptions((prev) => ({ ...prev, loading: false }))
                }
            })

        return () => {
            cancelled = true
        }
    }, [])

    return options
}
