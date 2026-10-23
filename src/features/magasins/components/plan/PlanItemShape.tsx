import type { PointerEvent as ReactPointerEvent } from "react"
import type { PlanItem } from "@/features/magasins/types/magasin.types"
import { itemCssColor } from "@/features/magasins/theme"
import {
    handleAnchor,
    RESIZE_HANDLES,
    rectOf,
    type Bounds,
    type ResizeHandle,
} from "@/features/magasins/utils/planGeometry"
import { polygonPoints } from "@/features/magasins/utils/contour"
import { toAbsolute } from "@/features/magasins/utils/shape"
import { StairsGroupShape, StairsTag } from "./StairsGroupShape"
import { MannequinMarks } from "./MannequinMarks"

const HANDLE = 0.35

const DOOR_LABEL = {
    entree: "Entrée",
    sortie: "Sortie",
    entree_sortie: "Entrée / sortie",
} as const

const FILL_OPACITY: Record<PlanItem["kind"], number> = {
    zone: 0.12,
    rayon: 0.45,
    etagere: 0.6,
    emplacement: 0.85,
    caisse: 0.75,
    entree: 0.9,
    sortie: 0.9,
    entree_sortie: 0.9,
    escalier: 0.3,
    escalier_colimacon: 0.3,
    mannequin: 0.8,
}

/** Giron d'une marche : distance entre deux nez de marche, en mètres. */
const STEP = 0.28

/**
 * Escalier vu de dessus, comme sur un plan d'architecte : une ligne par
 * marche en travers, et une flèche dans le sens de la montée — vers la
 * droite (ou le bas) du rectangle avant rotation.
 */
function StairsMarks({
    x,
    y,
    w,
    h,
    line,
}: {
    x: number
    y: number
    w: number
    h: number
    line: (m: number) => number
}) {
    const alongX = w >= h
    const length = alongX ? w : h
    // Tolérance : 2,8 / 0,28 vaut 9,999… en virgule flottante, une marche se perdait.
    const count = Math.max(1, Math.floor(length / STEP + 1e-9))
    const steps = Array.from({ length: count - 1 }, (_, i) => (i + 1) * (length / count))
    const mid = alongX ? y + h / 2 : x + w / 2
    const from = 0.15
    const to = length - 0.15
    const head = Math.min(0.3, (alongX ? h : w) * 0.35)
    const at = (along: number, across: number) => (alongX ? `${x + along},${across}` : `${across},${y + along}`)
    return (
        <g className="pointer-events-none stroke-foreground" fill="none" strokeWidth={line(0.02)}>
            {steps.map((d) =>
                alongX ? (
                    <line key={d} x1={x + d} y1={y} x2={x + d} y2={y + h} />
                ) : (
                    <line key={d} x1={x} y1={y + d} x2={x + w} y2={y + d} />
                ),
            )}
            <polyline points={`${at(from, mid)} ${at(to, mid)}`} strokeWidth={line(0.035)} />
            <polyline
                points={`${at(to - head, mid - head * 0.6)} ${at(to, mid)} ${at(to - head, mid + head * 0.6)}`}
                strokeWidth={line(0.035)}
                strokeLinejoin="round"
            />
        </g>
    )
}

/** Marches d'un colimaçon : une par 30°, sur un tour moins le palier. */
const SPIRAL_STEPS = 11
const SPIRAL_TURN = 330

/**
 * Colimaçon vu de dessus : le cercle, le poteau central, une ligne par marche
 * en rayon, et un arc fléché dans le sens de la montée (sens horaire, depuis
 * le haut du cercle avant rotation).
 */
function SpiralMarks({
    x,
    y,
    w,
    h,
    line,
}: {
    x: number
    y: number
    w: number
    h: number
    line: (m: number) => number
}) {
    const cx = x + w / 2
    const cy = y + h / 2
    const r = Math.min(w, h) / 2
    const polar = (deg: number, radius: number) => {
        const a = ((deg - 90) * Math.PI) / 180
        return [cx + radius * Math.cos(a), cy + radius * Math.sin(a)] as const
    }
    const step = SPIRAL_TURN / SPIRAL_STEPS
    const arcR = r * 0.62
    const [ax, ay] = polar(12, arcR)
    const [bx, by] = polar(SPIRAL_TURN - 12, arcR)
    const [tx, ty] = polar(SPIRAL_TURN - 12, arcR)
    const head = r * 0.16
    const [h1x, h1y] = polar(SPIRAL_TURN - 12 - (head / arcR) * (180 / Math.PI), arcR + head * 0.7)
    const [h2x, h2y] = polar(SPIRAL_TURN - 12 - (head / arcR) * (180 / Math.PI), arcR - head * 0.7)
    return (
        <g className="pointer-events-none stroke-foreground" fill="none" strokeWidth={line(0.02)}>
            <circle cx={cx} cy={cy} r={r} />
            <circle cx={cx} cy={cy} r={Math.max(0.06, r * 0.08)} className="fill-foreground" />
            {Array.from({ length: SPIRAL_STEPS + 1 }, (_, i) => {
                const [x1, y1] = polar(i * step, r * 0.08)
                const [x2, y2] = polar(i * step, r)
                return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />
            })}
            <path d={`M ${ax} ${ay} A ${arcR} ${arcR} 0 1 1 ${bx} ${by}`} strokeWidth={line(0.035)} />
            <polyline
                points={`${h1x},${h1y} ${tx},${ty} ${h2x},${h2y}`}
                strokeWidth={line(0.035)}
                strokeLinejoin="round"
            />
        </g>
    )
}

const DOORS = new Set<PlanItem["kind"]>(["entree", "sortie", "entree_sortie"])

interface PlanItemShapeProps {
    item: PlanItem
    bounds: Bounds
    selected: boolean
    /** Membre du groupe de la sélection (escalier fusionné) : contour éclairé, sans poignées. */
    grouped?: boolean
    editing: boolean
    /** Un outil (dessin, calage, contour) a la main : l'élément ne réagit pas. */
    inert: boolean
    /** Zoom d'affichage : la poignée garde sa taille à l'écran. */
    zoom: number
    onMoveStart: (event: ReactPointerEvent) => void
    onResizeStart: (event: ReactPointerEvent, handle: ResizeHandle) => void
    /** Poignée ronde au-dessus de l'objet : rotation libre à la souris. */
    onRotateStart?: (event: ReactPointerEvent) => void
    /** Angles en cours d'édition : les poignées de redimensionnement s'effacent. */
    hideHandles?: boolean
    /**
     * Escalier fusionné : toutes ses volées. Elles sont dessinées d'un seul
     * tenant par la première ; chacune ne garde que ses marches.
     */
    merged?: PlanItem[] | null
}

const HANDLE_LABEL: Record<ResizeHandle, string> = {
    nw: "coin haut-gauche",
    n: "côté haut",
    ne: "coin haut-droit",
    e: "côté droit",
    se: "coin bas-droit",
    s: "côté bas",
    sw: "coin bas-gauche",
    w: "côté gauche",
}

const HANDLE_CURSOR: Record<ResizeHandle, string> = {
    nw: "cursor-nwse-resize",
    se: "cursor-nwse-resize",
    ne: "cursor-nesw-resize",
    sw: "cursor-nesw-resize",
    n: "cursor-ns-resize",
    s: "cursor-ns-resize",
    e: "cursor-ew-resize",
    w: "cursor-ew-resize",
}

/**
 * Un élément du plan 2D vu de dessus : rectangle coloré, code, et selon le
 * type la barre d'un portant ou le nom d'une porte. En édition, la poignée du
 * coin bas-droit de l'élément sélectionné le redimensionne.
 */
export function PlanItemShape({
    item,
    bounds,
    selected,
    grouped = false,
    editing,
    inert,
    zoom,
    onMoveStart,
    onResizeStart,
    onRotateStart,
    hideHandles = false,
    merged = null,
}: PlanItemShapeProps) {
    const handle = HANDLE / zoom
    // Traits à épaisseur constante à l'écran (voir PlanSvg).
    const line = (meters: number) => meters / zoom
    const rect = rectOf(item.geometry)
    if (!rect) return null
    const lit = selected || grouped
    const color = itemCssColor(item)
    // Volée d'un escalier fusionné : surface de clic seule, le dessin est commun.
    const fillOpacity = merged ? 0 : FILL_OPACITY[item.kind]
    const stroke = merged ? "none" : lit ? "hsl(var(--primary))" : color
    const cx = rect.x + rect.w / 2
    const cy = rect.y + rect.h / 2
    const fontSize = Math.max(0.18, Math.min(0.5, rect.h * 0.45, (rect.w / Math.max(item.code.length, 1)) * 1.4))

    return (
        <>
            {merged && item.groupLeader && (
                <StairsGroupShape members={merged} color={color} lit={lit} zoom={zoom} fillOpacity={fillOpacity} />
            )}
            <g
                transform={item.geometry.rotation ? `rotate(${item.geometry.rotation} ${cx} ${cy})` : undefined}
                opacity={item.is_active ? 1 : 0.4}
                className={inert ? "pointer-events-none" : editing ? "cursor-move" : "cursor-pointer"}
                onPointerDown={onMoveStart}
            >
                <title>{item.label ? `${item.path} — ${item.label}` : item.path}</title>
                {item.forme ? (
                    // Forme libre : son tracé, à l'échelle du rectangle courant —
                    // déplacer ou redimensionner la zone l'emporte.
                    <polygon
                        points={polygonPoints(toAbsolute(item.forme, rect))}
                        fill={color}
                        fillOpacity={fillOpacity}
                        stroke={stroke}
                        strokeWidth={line(lit ? 0.12 : 0.04)}
                        strokeLinejoin="round"
                    />
                ) : (
                    <rect
                        x={rect.x}
                        y={rect.y}
                        width={rect.w}
                        height={rect.h}
                        rx={
                            item.kind === "escalier_colimacon" || item.kind === "mannequin"
                                ? Math.min(rect.w, rect.h) / 2
                                : item.kind === "zone"
                                  ? 0.15
                                  : 0.05
                        }
                        fill={color}
                        fillOpacity={fillOpacity}
                        stroke={stroke}
                        strokeWidth={line(lit ? 0.12 : 0.04)}
                        strokeDasharray={item.kind === "emplacement" || item.descend ? `${line(0.12)} ${line(0.08)}` : undefined}
                    />
                )}
                {selected && item.forme && (
                    // Boîte englobante en pointillés : c'est elle que l'on déplace
                    // et que la poignée redimensionne.
                    <rect
                        x={rect.x}
                        y={rect.y}
                        width={rect.w}
                        height={rect.h}
                        className="pointer-events-none fill-none stroke-primary"
                        strokeWidth={line(0.03)}
                        strokeDasharray={`${line(0.1)} ${line(0.08)}`}
                    />
                )}
                {item.kind === "etagere" && !item.forme && (
                    // Portant vu de dessus : sa barre, dans le sens de la longueur,
                    // et ses deux montants.
                    <g className="pointer-events-none stroke-foreground fill-foreground" strokeWidth={line(0.04)}>
                        {rect.w >= rect.h ? (
                            <>
                                <line x1={rect.x + 0.08} y1={cy} x2={rect.x + rect.w - 0.08} y2={cy} />
                                <circle cx={rect.x + 0.08} cy={cy} r={0.05} />
                                <circle cx={rect.x + rect.w - 0.08} cy={cy} r={0.05} />
                            </>
                        ) : (
                            <>
                                <line x1={cx} y1={rect.y + 0.08} x2={cx} y2={rect.y + rect.h - 0.08} />
                                <circle cx={cx} cy={rect.y + 0.08} r={0.05} />
                                <circle cx={cx} cy={rect.y + rect.h - 0.08} r={0.05} />
                            </>
                        )}
                    </g>
                )}
                {item.kind === "escalier" && !item.forme && (
                    <StairsMarks x={rect.x} y={rect.y} w={rect.w} h={rect.h} line={line} />
                )}
                {item.kind === "mannequin" && !item.forme && <MannequinMarks rect={rect} line={line} />}
                {item.kind === "escalier_colimacon" && !item.forme && (
                    <SpiralMarks x={rect.x} y={rect.y} w={rect.w} h={rect.h} line={line} />
                )}
                {DOORS.has(item.kind) && (
                    // Une porte est trop fine pour contenir son nom : il s'écrit à
                    // côté, côté intérieur si possible.
                    <text
                        x={cx}
                        y={rect.y + rect.h + 0.45 < bounds.depth ? rect.y + rect.h + 0.35 : rect.y - 0.15}
                        fontSize={0.32}
                        textAnchor="middle"
                        className="pointer-events-none font-semibold"
                        fill={color}
                    >
                        {DOOR_LABEL[item.kind as keyof typeof DOOR_LABEL]}
                    </text>
                )}
                {/* Escalier fusionné : un seul code, sur la première volée. */}
                {item.groupLeader && !merged && (
                    <text
                        x={item.kind === "zone" ? rect.x + 0.15 : cx}
                        y={item.kind === "zone" ? rect.y + fontSize + 0.1 : cy}
                        fontSize={fontSize}
                        textAnchor={item.kind === "zone" ? "start" : "middle"}
                        dominantBaseline={item.kind === "zone" ? "auto" : "central"}
                        className="pointer-events-none fill-foreground font-semibold"
                    >
                        {item.code}
                    </text>
                )}
                {item.groupLeader && !merged && (item.kind === "escalier" || item.kind === "escalier_colimacon") && (
                    <StairsTag x={cx} y={cy + fontSize} size={fontSize * 0.6} descend={item.descend} />
                )}
                {editing && selected && !hideHandles && onRotateStart && (
                    // Poignée de rotation, au-dessus du côté haut : elle tourne avec
                    // l'objet, on la saisit pour l'orienter à n'importe quel angle.
                    <g>
                        <line
                            x1={cx}
                            y1={rect.y}
                            x2={cx}
                            y2={rect.y - handle * 2.2}
                            className="pointer-events-none stroke-primary"
                            strokeWidth={line(0.03)}
                        />
                        <circle
                            cx={cx}
                            cy={rect.y - handle * 2.2}
                            r={handle * 0.6}
                            className="cursor-grab fill-background stroke-primary"
                            strokeWidth={line(0.05)}
                            onPointerDown={onRotateStart}
                            aria-label={`Tourner ${item.path}`}
                        />
                    </g>
                )}
                {editing &&
                    selected &&
                    !hideHandles &&
                    // Huit poignées, comme pour une image : chacune tire son coin ou son côté.
                    RESIZE_HANDLES.map((h) => {
                        const { u, v } = handleAnchor(h)
                        return (
                            <rect
                                key={h}
                                x={rect.x + u * rect.w - handle / 2}
                                y={rect.y + v * rect.h - handle / 2}
                                width={handle}
                                height={handle}
                                className={`${HANDLE_CURSOR[h]} fill-primary stroke-background`}
                                strokeWidth={line(0.04)}
                                onPointerDown={(e) => onResizeStart(e, h)}
                                aria-label={`Redimensionner ${item.path} — ${HANDLE_LABEL[h]}`}
                            />
                        )
                    })}
            </g>
        </>
    )
}
