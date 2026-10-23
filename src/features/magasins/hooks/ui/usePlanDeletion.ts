import { useState } from "react"
import { PLAN_KIND_LABEL } from "@/features/magasins/constants"
import type { PlanMagasinApi } from "@/features/magasins/hooks/data/usePlanMagasin"
import type { PlanItem } from "@/features/magasins/types/magasin.types"
import { deletionImpact } from "@/features/magasins/utils/deletion"
import { isMurKey, murIdOf, wallLength } from "@/features/magasins/utils/wall"
import { useDeleteShortcut } from "./useDeleteShortcut"

/** Ce que la confirmation affiche, et la suppression à lancer. */
export interface DeleteTarget {
    key: string
    /** « A · R1 », « Mur de 12 m »… : nommé sur le bouton et dans le titre. */
    name: string
    title: string
    description: string
    remove: () => Promise<boolean>
}

/** Cible de suppression de l'élément ou du mur sélectionné. */
export function deleteTargetFor(key: string | null, items: readonly PlanItem[], plan: PlanMagasinApi): DeleteTarget | null {
    if (!key) return null
    if (isMurKey(key)) {
        const mur = plan.murs.find((m) => m.id === murIdOf(key))
        if (!mur) return null
        const name = `mur de ${wallLength(mur.points).toLocaleString("fr-FR")} m`
        return {
            key,
            name,
            title: `Supprimer ce ${name} ?`,
            description: "Cette suppression est définitive.",
            remove: () => plan.removeMur(mur.id),
        }
    }
    const item = items.find((i) => i.key === key)
    if (!item) return null
    if (item.groupe) {
        // Escalier fusionné : toutes ses volées partent ensemble.
        const members = items.filter((i) => i.groupe === item.groupe)
        const leader = members.find((i) => i.groupLeader) ?? item
        const name = `escalier ${leader.code}`
        return {
            key,
            name,
            title: `Supprimer l'${name} (${members.length} volées) ?`,
            description: "Toutes ses volées seront supprimées. Cette suppression est définitive.",
            remove: () => plan.removeEquipements(members.map((m) => m.id)),
        }
    }
    return {
        key,
        name: item.path,
        title: `Supprimer ${PLAN_KIND_LABEL[item.kind].toLowerCase()} ${item.path} ?`,
        description: deletionImpact(item, plan),
        remove: () =>
            item.type === "zone"
                ? plan.removeZone(item.id)
                : item.type === "emplacement"
                  ? plan.removeEmplacement(item.id)
                  : plan.removeEquipement(item.id),
    }
}

/**
 * Suppression de la sélection du plan (élément ou mur) : cible courante,
 * demande par bouton ou touche Suppr, confirmation en cours.
 */
export function usePlanDeletion(
    selectedKey: string | null,
    items: readonly PlanItem[],
    plan: PlanMagasinApi,
    { enabled, shortcut }: { enabled: boolean; shortcut: boolean },
) {
    const [pending, setPending] = useState<DeleteTarget | null>(null)
    const target = enabled ? deleteTargetFor(selectedKey, items, plan) : null
    const request = () => {
        if (target) setPending(target)
    }
    useDeleteShortcut(Boolean(target) && shortcut && !pending, request)
    return { target, pending, request, clear: () => setPending(null) }
}
