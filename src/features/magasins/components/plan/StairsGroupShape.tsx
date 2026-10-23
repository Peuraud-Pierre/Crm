import type { PlanItem } from "@/features/magasins/types/magasin.types"
import { polygonPoints } from "@/features/magasins/utils/contour"
import { rectOf } from "@/features/magasins/utils/planGeometry"
import { toAbsolute } from "@/features/magasins/utils/shape"

interface Paint {
    fill: string
    stroke?: string
    strokeWidth?: number
    strokeLinejoin?: "round"
    strokeDasharray?: string
}

/** Silhouette d'une volée (rectangle, colimaçon arrondi ou forme libre), tournée. */
function Silhouette({ item, ...paint }: { item: PlanItem } & Paint) {
    const rect = rectOf(item.geometry)
    if (!rect) return null
    const cx = rect.x + rect.w / 2
    const cy = rect.y + rect.h / 2
    const transform = item.geometry.rotation ? `rotate(${item.geometry.rotation} ${cx} ${cy})` : undefined
    if (item.forme) {
        return <polygon {...paint} transform={transform} points={polygonPoints(toAbsolute(item.forme, rect))} />
    }
    return (
        <rect
            {...paint}
            transform={transform}
            x={rect.x}
            y={rect.y}
            width={rect.w}
            height={rect.h}
            rx={item.kind === "escalier_colimacon" ? Math.min(rect.w, rect.h) / 2 : 0.05}
        />
    )
}

/** « ▲ monte » ou « ▼ descend », sous le code d'un escalier. */
export function StairsTag({ x, y, size, descend }: { x: number; y: number; size: number; descend: boolean }) {
    return (
        <text
            x={x}
            y={y}
            fontSize={size}
            textAnchor="middle"
            dominantBaseline="central"
            className="pointer-events-none fill-foreground font-semibold"
            paintOrder="stroke"
            stroke="hsl(var(--background))"
            strokeWidth={size * 0.2}
        >
            {descend ? "▼ descend" : "▲ monte"}
        </text>
    )
}

interface StairsGroupShapeProps {
    /** Toutes les volées de l'escalier fusionné. */
    members: PlanItem[]
    color: string
    lit: boolean
    zoom: number
    fillOpacity: number
}

/**
 * Escalier fusionné dessiné d'un seul tenant : un remplissage uniforme et un
 * seul contour, celui de l'union des volées — les bords qu'elles partagent
 * disparaissent. Le contour est tracé deux fois plus épais puis masqué par
 * l'intérieur des volées : n'en reste que la moitié extérieure. Le code de
 * l'escalier se place au centre de l'ensemble.
 */
export function StairsGroupShape({ members, color, lit, zoom, fillOpacity }: StairsGroupShapeProps) {
    const rects = members.map((m) => rectOf(m.geometry)).filter((r) => r !== null)
    if (rects.length === 0) return null
    const minX = Math.min(...rects.map((r) => r.x))
    const minY = Math.min(...rects.map((r) => r.y))
    const maxX = Math.max(...rects.map((r) => r.x + r.w))
    const maxY = Math.max(...rects.map((r) => r.y + r.h))
    // Marge large : une volée tournée déborde de son rectangle.
    const pad = Math.max(maxX - minX, maxY - minY)
    const maskId = `stairs-${members[0].groupe ?? members[0].id}`
    const width = (lit ? 0.12 : 0.04) / zoom
    const leader = members.find((m) => m.groupLeader) ?? members[0]
    const fontSize = Math.max(0.18, Math.min(0.5, (maxY - minY) * 0.3))

    return (
        <g className="pointer-events-none" opacity={leader.is_active ? 1 : 0.4}>
            <mask
                id={maskId}
                maskUnits="userSpaceOnUse"
                x={minX - pad}
                y={minY - pad}
                width={maxX - minX + 2 * pad}
                height={maxY - minY + 2 * pad}
            >
                <rect
                    x={minX - pad}
                    y={minY - pad}
                    width={maxX - minX + 2 * pad}
                    height={maxY - minY + 2 * pad}
                    fill="white"
                />
                {members.map((m) => (
                    <Silhouette key={m.key} item={m} fill="black" />
                ))}
            </mask>
            {/* Remplissage opaque, rendu translucide d'un bloc : pas de surépaisseur aux recouvrements. */}
            <g opacity={fillOpacity}>
                {members.map((m) => (
                    <Silhouette key={m.key} item={m} fill={color} />
                ))}
            </g>
            <g mask={`url(#${maskId})`}>
                {members.map((m) => (
                    <Silhouette
                        key={m.key}
                        item={m}
                        fill="none"
                        stroke={lit ? "hsl(var(--primary))" : color}
                        strokeWidth={width * 2}
                        strokeLinejoin="round"
                        strokeDasharray={leader.descend ? `${0.24 / zoom} ${0.16 / zoom}` : undefined}
                    />
                ))}
            </g>
            <text
                x={(minX + maxX) / 2}
                y={(minY + maxY) / 2}
                fontSize={fontSize}
                textAnchor="middle"
                dominantBaseline="central"
                className="fill-foreground font-semibold"
                paintOrder="stroke"
                stroke="hsl(var(--background))"
                strokeWidth={fontSize * 0.15}
            >
                {leader.code}
            </text>
            <StairsTag x={(minX + maxX) / 2} y={(minY + maxY) / 2 + fontSize} size={fontSize * 0.6} descend={leader.descend} />
        </g>
    )
}
