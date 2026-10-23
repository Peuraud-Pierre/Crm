import { useState } from "react"
import type { PlanMagasinApi } from "@/features/magasins/hooks/data/usePlanMagasin"
import type { Mur, PlanItem, Point } from "@/features/magasins/types/magasin.types"
import { rectOf, type Rect } from "@/features/magasins/utils/planGeometry"
import { toAbsolute } from "@/features/magasins/utils/shape"
import type { PlanEditTool } from "@/features/magasins/components/plan/PlanEditToolbar"

/** Angles d'un rectangle, dans l'ordre (haut-gauche, haut-droit, bas-droit, bas-gauche). */
export function rectCorners(rect: Rect): Point[] {
    return [
        [rect.x, rect.y],
        [rect.x + rect.w, rect.y],
        [rect.x + rect.w, rect.y + rect.h],
        [rect.x, rect.y + rect.h],
    ]
}

type ShapeableItem = PlanItem & { type: "zone" | "equipement" }

/** Les zones et les équipements ont une forme ; un emplacement, non. */
const isShapeable = (item: PlanItem): item is ShapeableItem => item.type === "zone" || item.type === "equipement"

interface PointEditingOptions {
    editing: boolean
    tool: PlanEditTool
    selected: PlanItem | null
    selectedWall: Mur | null
    plan: PlanMagasinApi
    /** Brouillon de l'éditeur : la géométrie d'un objet re-tracé y est oubliée. */
    discard: (key: string) => void
}

/**
 * Édition point par point de la sélection, en mode édition et sans outil :
 *  · un objet (zone, rayon, portant, caisse, porte, escalier…) passe en mode
 *    « angles » à la demande — ses poignées de redimensionnement laissent
 *    alors la place à ses angles, comme pour le contour de l'étage ;
 *  · un mur montre toujours ses points.
 * Un objet tourné doit être remis à 0° pour éditer ses angles.
 */
export function usePointEditing({ editing, tool, selected, selectedWall, plan, discard }: PointEditingOptions) {
    const [cornerKey, setCornerKey] = useState<string | null>(null)
    const shapeable = selected && isShapeable(selected) ? selected : null
    const cornersOn = Boolean(shapeable && cornerKey === shapeable.key)
    const shapeItem = editing && tool === null && cornersOn ? shapeable : null
    const rect = shapeItem && !shapeItem.geometry.rotation ? rectOf(shapeItem.geometry) : null

    const shapeEdit =
        shapeItem && rect
            ? {
                  points: shapeItem.forme ? toAbsolute(shapeItem.forme, rect) : rectCorners(rect),
                  onChange: async (points: Point[]) => {
                      // Enregistré tout de suite : la position en brouillon de
                      // l'objet est remplacée par celle de sa nouvelle forme.
                      if (await plan.updateShape(shapeItem, points)) discard(shapeItem.key)
                  },
              }
            : null

    const wallEdit =
        editing && tool === null && selectedWall
            ? { points: selectedWall.points, onChange: (points: Point[]) => void plan.updateMur(selectedWall.id, { points }) }
            : null

    return {
        /** Objet dont les angles sont en cours d'édition (poignées masquées). */
        shapeItem,
        shapeEdit,
        wallEdit,
        /** Commandes de la fiche de l'objet sélectionné. */
        corners: shapeable
            ? {
                  on: cornersOn,
                  toggle: () => setCornerKey(cornersOn ? null : shapeable.key),
                  reset: shapeable.forme
                      ? async () => {
                            if (await plan.updateShape(shapeable, null)) {
                                discard(shapeable.key)
                                setCornerKey(null)
                            }
                        }
                      : null,
              }
            : null,
    }
}
