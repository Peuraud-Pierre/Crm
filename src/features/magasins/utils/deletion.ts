import type { EmplacementMagasin, PlanItem, ZoneMagasin } from "@/features/magasins/types/magasin.types"
import { descendantZoneIds, emplacementsUnder } from "./planTree"

/** Ce qu'emporte la suppression d'un élément (cascade en base). */
export function deletionImpact(
    item: PlanItem,
    plan: { zones: readonly ZoneMagasin[]; emplacements: readonly EmplacementMagasin[] },
): string {
    if (item.type !== "zone") return "Cette suppression est définitive."
    const sousNiveaux = descendantZoneIds(item.id, plan.zones).length - 1
    const emplacements = emplacementsUnder(item.id, plan.zones, plan.emplacements).length
    const parts = [
        sousNiveaux > 0 && `${sousNiveaux} sous-niveau${sousNiveaux > 1 ? "x" : ""} (rayons, portants)`,
        emplacements > 0 && `${emplacements} emplacement${emplacements > 1 ? "s" : ""}`,
    ].filter(Boolean)
    return parts.length
        ? `Seront aussi supprimés : ${parts.join(" et ")}. Cette suppression est définitive.`
        : "Cette suppression est définitive."
}
