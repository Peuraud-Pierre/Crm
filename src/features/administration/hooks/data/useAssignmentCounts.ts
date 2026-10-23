import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { countProfilesByAssignment } from "../../services/userAdminService"
import type { AssignmentCounts } from "../../types"

const EMPTY_COUNTS: AssignmentCounts = {
    byRole: new Map(),
    byService: new Map(),
}

/**
 * Effectifs par rôle et par service — cartes rôles/services, bandes de stats
 * et avertissements de suppression (impact « N utilisateurs »).
 */
export function useAssignmentCounts() {
    const [counts, setCounts] = useState<AssignmentCounts>(EMPTY_COUNTS)
    const [loading, setLoading] = useState(true)
    // Dernière requête gagne : ignore une réponse dépassée par un refetch plus récent.
    const requestIdRef = useRef(0)

    const refetch = useCallback(async () => {
        const requestId = ++requestIdRef.current
        try {
            const result = await countProfilesByAssignment()
            if (requestIdRef.current !== requestId) return
            setCounts(result)
        } catch (err) {
            if (requestIdRef.current !== requestId) return
            console.error("Erreur chargement effectifs:", err)
            toast.error("Erreur lors du chargement des effectifs")
        } finally {
            if (requestIdRef.current === requestId) setLoading(false)
        }
    }, [])

    useEffect(() => {
        refetch()
    }, [refetch])

    return { byRole: counts.byRole, byService: counts.byService, loading, refetch }
}
