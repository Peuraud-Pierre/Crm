import { useEffect, useState } from "react"
import { toast } from "sonner"
import type { PlanMagasinApi } from "@/features/magasins/hooks/data/usePlanMagasin"
import type { PlanItem } from "@/features/magasins/types/magasin.types"
import { groupMembers, isStairs, mergedIds } from "@/features/magasins/utils/group"

/**
 * Fusion d'escaliers en un seul : depuis la fiche d'un escalier, « Fusionner
 * avec… » puis un clic sur l'autre escalier du plan. Échap annule. « Séparer »
 * rend leur indépendance aux volées.
 */
export function useStairsMerge(plan: PlanMagasinApi, items: readonly PlanItem[], select: (key: string | null) => void) {
    const [fromKey, setFromKey] = useState<string | null>(null)
    const from = fromKey ? (items.find((i) => i.key === fromKey) ?? null) : null

    useEffect(() => {
        if (!fromKey) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setFromKey(null)
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [fromKey])

    /** Clic sur le plan pendant la fusion : `true` s'il a été consommé. */
    const pick = (key: string | null): boolean => {
        if (!from) return false
        const target = key ? items.find((i) => i.key === key) : undefined
        if (!target || target.key === from.key) {
            setFromKey(null)
            return key === null
        }
        if (!isStairs(target)) {
            toast.error("Seuls des escaliers peuvent être fusionnés.")
            return true
        }
        if (target.groupe && target.groupe === from.groupe) {
            toast.info("Ces volées forment déjà le même escalier.")
            setFromKey(null)
            return true
        }
        const ids = mergedIds(from, target, items)
        setFromKey(null)
        void plan.mergeEquipements(ids).then((ok) => ok && select(from.key))
        return true
    }

    /** Commandes de la fiche, pour un escalier sélectionné en édition. */
    const controlsFor = (item: PlanItem | null) =>
        item && isStairs(item)
            ? {
                  merging: fromKey === item.key,
                  start: () => setFromKey(fromKey === item.key ? null : item.key),
                  ungroup: item.groupe ? () => void plan.ungroupEquipements(item.groupe as string) : null,
                  // Le sens vaut pour tout l'escalier : ses volées fusionnées suivent.
                  descend: item.descend,
                  setDescend: (descend: boolean) =>
                      void plan.setStairsDescend(
                          groupMembers(item, items).map((m) => m.id),
                          descend,
                      ),
              }
            : null

    return { from, pick, controlsFor, cancel: () => setFromKey(null) }
}
