import type { Rect } from "@/features/magasins/utils/planGeometry"

/**
 * Mannequin vu de dessus : la ligne des épaules dans la longueur, la tête au
 * centre, et un petit nez du côté où il regarde — vers le bas du rectangle
 * (ou la droite s'il est posé en long), avant rotation : la vitrine se
 * règle en le tournant.
 */
export function MannequinMarks({ rect, line }: { rect: Rect; line: (m: number) => number }) {
    const cx = rect.x + rect.w / 2
    const cy = rect.y + rect.h / 2
    const alongX = rect.w >= rect.h
    const half = Math.max(rect.w, rect.h) / 2 - 0.04
    const head = Math.min(rect.w, rect.h) * 0.28
    // Côté du regard : +y si les épaules sont en largeur, +x sinon.
    const [fx, fy] = alongX ? [0, 1] : [1, 0]
    const nose = head * 1.5
    return (
        <g className="pointer-events-none stroke-background fill-background" strokeWidth={line(0.03)}>
            <line
                x1={alongX ? cx - half : cx}
                y1={alongX ? cy : cy - half}
                x2={alongX ? cx + half : cx}
                y2={alongX ? cy : cy + half}
                strokeWidth={line(0.05)}
                strokeLinecap="round"
            />
            <circle cx={cx} cy={cy} r={head} />
            <polygon
                points={`${cx + fx * nose},${cy + fy * nose} ${cx + fy * head * 0.6},${cy + fx * head * 0.6} ${cx - fy * head * 0.6},${cy - fx * head * 0.6}`}
            />
        </g>
    )
}
