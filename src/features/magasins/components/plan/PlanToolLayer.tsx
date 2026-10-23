import type { Point } from "@/features/magasins/types/magasin.types"
import type { Bounds } from "@/features/magasins/utils/planGeometry"
import type { PlanEditTool } from "./PlanEditToolbar"
import type { PlanSvgContext } from "./PlanSvg"
import { PolygonEditor } from "./PolygonEditor"
import { SketchLayer } from "./SketchLayer"

/** Points d'un élément sélectionné, retouchables sur le plan. */
export interface PointsEdit {
    points: Point[]
    onChange: (points: Point[]) => void
}

interface PlanToolLayerProps {
    context: PlanSvgContext
    tool: PlanEditTool
    bounds: Bounds
    /** Contour de l'étage, pour l'outil « contour ». */
    contourPoints: Point[]
    onContourChange: (points: Point[]) => void
    /** Forme libre fermée, pour l'outil « tracé ». */
    onSketch: (points: Point[]) => void
    /** Mur tracé (ligne ouverte), pour l'outil « mur ». */
    onWall: (points: Point[]) => void
    /** Hors outil : points de la forme libre ou du mur sélectionné. */
    shapeEdit: PointsEdit | null
    wallEdit: PointsEdit | null
}

/**
 * Calque d'outils du mode édition, posé par-dessus le plan (`overlay` de
 * `PlanSvg`) : un seul à la fois, selon l'outil actif ou, sans outil, selon
 * ce qui est sélectionné.
 */
export function PlanToolLayer({
    context,
    tool,
    bounds,
    contourPoints,
    onContourChange,
    onSketch,
    onWall,
    shapeEdit,
    wallEdit,
}: PlanToolLayerProps) {
    if (tool === "contour") {
        return <PolygonEditor context={context} bounds={bounds} points={contourPoints} onChange={onContourChange} />
    }
    if (tool === "sketch") return <SketchLayer context={context} bounds={bounds} onFinish={onSketch} />
    if (tool === "wallLine") {
        return <SketchLayer context={context} bounds={bounds} onFinish={onWall} closed={false} maxPoints={2} />
    }
    if (tool === "wall") return <SketchLayer context={context} bounds={bounds} onFinish={onWall} closed={false} />
    if (shapeEdit) return <PolygonEditor context={context} bounds={bounds} points={shapeEdit.points} onChange={shapeEdit.onChange} />
    if (wallEdit) {
        return <PolygonEditor context={context} bounds={bounds} points={wallEdit.points} onChange={wallEdit.onChange} closed={false} />
    }
    return null
}
