import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import * as layoutService from "@/features/stock_handpick/services/planLayoutService"
import { DEFAULT_FLOOR, type FloorLayout } from "@/features/stock_handpick/utils/floorPlan"
import { normalizeLayout } from "@/features/stock_handpick/utils/floorPlanEdit"

/**
 * Disposition du plan : celle enregistrée en base, sinon la disposition par
 * défaut. Une disposition enregistrée ailleurs arrive par le realtime.
 *
 * Tant que la table n'existe pas (migration non appliquée), la lecture échoue
 * en silence et l'écran garde la disposition par défaut : le plan reste
 * consultable, seul l'enregistrement est impossible.
 */
export function usePlanLayout() {
    const { user } = useAuth()
    const [layout, setLayout] = useState<FloorLayout>(DEFAULT_FLOOR)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    /** Vrai si la disposition affichée vient de la base. */
    const [isCustom, setIsCustom] = useState(false)

    const fetchLayout = useCallback(async () => {
        try {
            const stored = await layoutService.fetchPlanLayout()
            setLayout(stored ? normalizeLayout(stored.layout) : DEFAULT_FLOOR)
            setIsCustom(stored !== null)
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        if (!user?.user_id) return
        fetchLayout()
        return layoutService.subscribeToPlanLayout(user.user_id, () => {
            fetchLayout()
        })
    }, [user?.user_id, fetchLayout])

    /** Vrai si l'enregistrement a abouti. */
    const save = useCallback(async (next: FloorLayout): Promise<boolean> => {
        setSaving(true)
        try {
            await layoutService.savePlanLayout(next)
            setLayout(next)
            setIsCustom(true)
            toast.success("Plan enregistré")
            return true
        } catch (error) {
            console.error(error)
            toast.error("Impossible d'enregistrer le plan")
            return false
        } finally {
            setSaving(false)
        }
    }, [])

    return { layout, loading, saving, isCustom, save, refetch: fetchLayout }
}
