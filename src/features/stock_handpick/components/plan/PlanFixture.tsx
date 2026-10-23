import type { SVGProps } from "react"
import type { FixtureSpec, Rect } from "@/features/stock_handpick/utils/floorPlan"

/**
 * Attribut `transform` d'un élément tourné autour du centre de son rectangle,
 * ou `undefined` sans angle. Même convention que le modèle : degrés, sens
 * horaire à l'écran.
 */
export function rotateAround(rect: Rect, rotation: number | undefined): string | undefined {
    if (!rotation) return undefined
    return `rotate(${rotation} ${rect.x + rect.w / 2} ${rect.z + rect.d / 2})`
}

/** Taille des libellés, en mètres (unités du SVG) — la même que `PlanFloor`. */
const LABEL_SIZE = 0.62

interface RectShapeProps extends Omit<SVGProps<SVGRectElement>, "x" | "y" | "width" | "height"> {
    rect: Rect
}

export function RectShape({ rect, ...props }: RectShapeProps) {
    return <rect x={rect.x} y={rect.z} width={rect.w} height={rect.d} {...props} />
}

/** Aménagements neutres : passerelle, zones de stockage, estrade, pesée… */
export function Fixture({ fixture }: { fixture: FixtureSpec }) {
    const { rect, kind, label } = fixture
    const neutral = "fill-muted-foreground/10 stroke-muted-foreground/60"

    let shape
    if (kind === "washer") {
        // Lave-linge vu de dessus : caisse carrée, hublot rond.
        shape = (
            <>
                <RectShape rect={rect} rx={0.1} className={neutral} strokeWidth={0.08} />
                <circle
                    cx={rect.x + rect.w / 2}
                    cy={rect.z + rect.d / 2}
                    r={rect.w * 0.28}
                    className="fill-none stroke-muted-foreground/70"
                    strokeWidth={0.07}
                />
            </>
        )
    } else if (kind === "sofa") {
        // Canapé vu de dessus : assise, dossier sur un côté long, accoudoirs
        // aux deux petits bouts — qu'il soit posé en largeur ou en hauteur
        // (même règle que la 3D : dossier en haut, ou à droite une fois tourné).
        const wide = rect.w >= rect.d
        const length = wide ? rect.w : rect.d
        const depth = wide ? rect.d : rect.w
        const back = Math.min(0.22, depth * 0.25)
        const arm = Math.min(0.22, length * 0.12)
        const strip = "fill-muted-foreground/30"
        shape = (
            <>
                <RectShape rect={rect} rx={0.12} className={neutral} strokeWidth={0.08} />
                {wide ? (
                    <>
                        <RectShape rect={{ ...rect, d: back }} className={strip} />
                        <RectShape rect={{ ...rect, w: arm }} className={strip} />
                        <RectShape rect={{ ...rect, x: rect.x + rect.w - arm, w: arm }} className={strip} />
                    </>
                ) : (
                    <>
                        <RectShape rect={{ ...rect, x: rect.x + rect.w - back, w: back }} className={strip} />
                        <RectShape rect={{ ...rect, d: arm }} className={strip} />
                        <RectShape rect={{ ...rect, z: rect.z + rect.d - arm, d: arm }} className={strip} />
                    </>
                )}
            </>
        )
    } else if (kind === "table") {
        shape = <RectShape rect={rect} rx={0.08} className={neutral} strokeWidth={0.1} />
    } else if (kind === "guard") {
        shape = <RectShape rect={rect} className="fill-destructive/70" />
    } else if (kind === "walkway") {
        // Caillebotis : quadrillage serré.
        const step = 0.45
        shape = (
            <>
                <RectShape rect={rect} className="fill-muted-foreground/25 stroke-muted-foreground/70" strokeWidth={0.08} />
                {Array.from({ length: Math.floor(rect.d / step) - 1 }, (_, i) => (
                    <line
                        key={i}
                        x1={rect.x}
                        x2={rect.x + rect.w}
                        y1={rect.z + (i + 1) * step}
                        y2={rect.z + (i + 1) * step}
                        className="stroke-muted-foreground/40"
                        strokeWidth={0.04}
                    />
                ))}
            </>
        )
    } else if (kind === "storage") {
        // Hachures, comme au tableau.
        const lines = Math.max(2, Math.round((rect.w + rect.d) / 0.8))
        shape = (
            <>
                <RectShape rect={rect} className={neutral} strokeWidth={0.08} />
                <clipPath id={`clip-${fixture.id}`}>
                    <RectShape rect={rect} />
                </clipPath>
                <g clipPath={`url(#clip-${fixture.id})`}>
                    {Array.from({ length: lines }, (_, i) => {
                        const offset = (i * (rect.w + rect.d)) / lines
                        return (
                            <line
                                key={i}
                                x1={rect.x + offset}
                                y1={rect.z}
                                x2={rect.x + offset - rect.d}
                                y2={rect.z + rect.d}
                                className="stroke-muted-foreground/40"
                                strokeWidth={0.06}
                            />
                        )
                    })}
                </g>
            </>
        )
    } else {
        shape = (
            <RectShape
                rect={rect}
                rx={kind === "platform" ? 0.4 : 0}
                className={neutral}
                strokeWidth={0.08}
            />
        )
    }

    return (
        <g className="pointer-events-none" transform={rotateAround(rect, fixture.rotation)}>
            {shape}
            {label && (
                <text
                    x={kind === "washer" ? rect.x : rect.x + rect.w / 2}
                    y={kind === "washer" ? rect.z - 0.4 : rect.z + rect.d / 2}
                    fontSize={LABEL_SIZE}
                    textAnchor={kind === "washer" ? "start" : "middle"}
                    dominantBaseline="central"
                    transform={
                        kind === "displayWall" || kind === "walkway"
                            ? `rotate(-90 ${rect.x + rect.w / 2} ${rect.z + rect.d / 2})`
                            : undefined
                    }
                    className="fill-muted-foreground"
                >
                    {label}
                </text>
            )}
        </g>
    )
}
