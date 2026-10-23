import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import * as planService from "@/features/stock_handpick/services/planHandpickService"
import { STOCK_HANDPICK_PERMISSIONS } from "@/features/stock_handpick/constants"
import type { Emplacement, ZoneNode } from "@/features/stock_handpick/types/location.types"
import type { FloorLayout } from "@/features/stock_handpick/utils/floorPlan"
import { planStructureSync } from "@/features/stock_handpick/utils/planStructureSync"

interface PlanStructureSyncInput {
    zones: ZoneNode[]
    emplacements: Emplacement[]
    /** Vrai tant que l'arbre ou la disposition se chargent : rien n'est calculé. */
    loading: boolean
    layout: FloorLayout
    /** Appelé après une création réussie, pour recharger l'arbre. */
    onSynced: () => void | Promise<void>
}

/**
 * Crée en base les emplacements qu'attend le plan (rangées, travées,
 * hauteurs, sols) et rattrape les structures laissées par des migrations
 * partielles — voir `utils/planStructureSync.ts`.
 *
 * Lancé AUTOMATIQUEMENT une fois par montage quand il manque quelque chose et
 * que l'utilisateur en a le droit (`plan.create`, plus `plan.update` s'il faut
 * déplacer ou renommer). Sinon, `missing` permet d'afficher ce qui manque.
 */
export function usePlanStructureSync({ zones, emplacements, loading, layout, onSynced }: PlanStructureSyncInput) {
    const { hasPermission } = useAuth()
    const canCreate = hasPermission(STOCK_HANDPICK_PERMISSIONS.planCreate)
    const canUpdate = hasPermission(STOCK_HANDPICK_PERMISSIONS.planUpdate)

    const plan = useMemo(
        () => (loading ? null : planStructureSync(zones, emplacements, layout)),
        [loading, zones, emplacements, layout],
    )
    const [syncing, setSyncing] = useState(false)
    const [failed, setFailed] = useState(false)
    const attemptedRef = useRef(false)

    const allowed = Boolean(plan && canCreate && (!plan.needsUpdate || canUpdate))
    const pending = Boolean(plan && plan.ops.length > 0)

    const run = useCallback(async () => {
        if (!plan || plan.ops.length === 0) return
        setSyncing(true)
        setFailed(false)
        const ids = new Map(plan.ids)
        const idOf = (key: string | null) => {
            if (key === null) return null
            const id = ids.get(key)
            if (!id) throw new Error(`Zone introuvable pour « ${key} »`)
            return id
        }
        try {
            for (const op of plan.ops) {
                if (op.type === "createZone") {
                    const created = await planService.insertZone({
                        parent_id: idOf(op.parentKey),
                        kind: op.kind,
                        code: op.code,
                        label: op.label,
                        sort_order: op.sort,
                    })
                    ids.set(op.key, created.id)
                } else if (op.type === "moveZone") {
                    await planService.patchZone(op.zoneId, { parent_id: idOf(op.parentKey) })
                    ids.set(op.key, op.zoneId)
                } else if (op.type === "renameZone") {
                    await planService.patchZone(op.zoneId, { code: op.code, label: op.label, sort_order: op.sort })
                    ids.set(op.key, op.zoneId)
                } else {
                    await planService.insertEmplacement({
                        zone_id: idOf(op.parentKey)!,
                        code: op.code,
                        label: op.label,
                    })
                }
            }
            toast.success(`Emplacements du plan reliés : ${plan.missing.join(", ")}`)
        } catch (error) {
            console.error(error)
            setFailed(true)
            toast.error("Impossible de créer tous les emplacements du plan")
        } finally {
            // Même en échec partiel : ce qui a été créé doit apparaître.
            await onSynced()
            setSyncing(false)
        }
    }, [plan, onSynced])

    useEffect(() => {
        if (!pending || !allowed || attemptedRef.current) return
        attemptedRef.current = true
        void run()
    }, [pending, allowed, run])

    return {
        /** Ce qui manque en base pour relier le plan, en clair. */
        missing: pending ? plan!.missing : [],
        syncing,
        failed,
        /** Faux si l'utilisateur n'a pas les droits pour créer ce qui manque. */
        allowed,
        retry: run,
    }
}
