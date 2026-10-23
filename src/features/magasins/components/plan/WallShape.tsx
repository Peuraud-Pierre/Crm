import type { PointerEvent as ReactPointerEvent } from "react"
import type { Mur } from "@/features/magasins/types/magasin.types"
import { polygonPoints } from "@/features/magasins/utils/contour"
import { filledOutline, wallLength } from "@/features/magasins/utils/wall"

interface WallShapeProps {
    mur: Mur
    selected: boolean
    inert: boolean
    zoom: number
    onSelect: (event: ReactPointerEvent) => void
}

/**
 * Mur vu de dessus : sa vraie épaisseur, en mètres (il grossit avec le zoom,
 * comme le dessin). Une bande de clic plus large que le mur permet d'attraper
 * une cloison fine sans viser au millimètre.
 */
export function WallShape({ mur, selected, inert, zoom, onSelect }: WallShapeProps) {
    const points = polygonPoints(mur.points)
    // Quatre points : le pourtour d'un mur plein, rempli.
    const outline = filledOutline(mur.points)
    if (outline) {
        const polygon = polygonPoints(outline)
        return (
            <g className={inert ? "pointer-events-none" : "cursor-pointer"} onPointerDown={onSelect}>
                <title>{`Mur plein — ${Math.round(wallLength([...outline, outline[0]]) * 100) / 100} m de pourtour`}</title>
                <polygon
                    points={polygon}
                    className={selected ? "fill-foreground stroke-primary" : "fill-foreground stroke-foreground"}
                    fillOpacity={0.85}
                    strokeWidth={(selected ? 0.12 : 0.03) / zoom}
                    strokeLinejoin="miter"
                />
            </g>
        )
    }
    return (
        <g className={inert ? "pointer-events-none" : "cursor-pointer"} onPointerDown={onSelect}>
            <title>{`Mur — ${wallLength(mur.points).toLocaleString("fr-FR")} m, ${Math.round(mur.epaisseur * 100)} cm`}</title>
            <polyline points={points} fill="none" stroke="transparent" strokeWidth={Math.max(mur.epaisseur, 0.35 / zoom)} />
            {selected && (
                <polyline
                    points={points}
                    fill="none"
                    className="stroke-primary"
                    strokeWidth={mur.epaisseur + 0.12 / zoom}
                    strokeLinejoin="miter"
                    opacity={0.5}
                />
            )}
            <polyline points={points} fill="none" className="stroke-foreground" strokeWidth={mur.epaisseur} strokeLinejoin="miter" />
        </g>
    )
}
