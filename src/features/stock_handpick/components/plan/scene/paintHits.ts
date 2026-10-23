import type * as THREE from "three"
import type { PlanSelection } from "@/features/stock_handpick/utils/planLayout"
import { HIGHLIGHT_COLORS, type BayHit } from "./warehouseScene"

/** Teinte les volumes de sélection : sélection d'abord, survol ensuite. */
export function paintHits(
    hits: THREE.Mesh[],
    selection: PlanSelection | null,
    hovered: THREE.Mesh | null,
) {
    for (const mesh of hits) {
        const bay = mesh.userData.hit as BayHit | undefined
        if (!bay) continue
        const material = mesh.material as THREE.MeshBasicMaterial
        const selected =
            selection?.kind === "shelf" &&
            selection.row === bay.row &&
            selection.shelf === bay.shelf
        if (selected) {
            material.color.set(HIGHLIGHT_COLORS.selected)
            material.opacity = 0.28
        } else if (mesh === hovered) {
            material.color.set(HIGHLIGHT_COLORS.hover)
            material.opacity = 0.16
        } else {
            material.opacity = 0
        }
    }
}
