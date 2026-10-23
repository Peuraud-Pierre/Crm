import { rotatePoint, type FloorLayout } from "./floorPlan"
import type { ElementKind, ElementRef } from "./floorPlanEdit"

/**
 * Angle libre des éléments du plan, pour les poser en diagonale : angle
 * autour du centre pour racks, meubles et bureaux ; rotation autour du milieu
 * pour portes et cloisons.
 */

const round = (value: number) => Math.round(value * 100) / 100

function segmentOf(floor: FloorLayout, ref: ElementRef): [[number, number], [number, number]] | null {
    const list = ref.kind === "door" ? floor.doors : ref.kind === "wall" ? floor.innerWalls : []
    const item = list.find((x) => x.id === ref.id)
    return item ? [item.from, item.to] : null
}

/** Éléments qui acceptent un angle libre autour de leur centre. */
export const ANGLED_KINDS: ReadonlySet<ElementKind> = new Set(["rack", "fixture", "office"])

/** Ramène un angle dans ]-180, 180], au degré près. */
export const normalizeAngle = (degrees: number) => {
    const wrapped = ((Math.round(degrees) % 360) + 360) % 360
    return wrapped > 180 ? wrapped - 360 : wrapped
}

/** Angle d'un élément, en degrés (0 si aucun). */
export function elementRotation(floor: FloorLayout, ref: ElementRef): number {
    switch (ref.kind) {
        case "rack":
            return floor.racks.find((r) => r.id === ref.id)?.rotation ?? 0
        case "fixture":
            return floor.fixtures.find((f) => f.id === ref.id)?.rotation ?? 0
        case "office":
            return floor.offices.find((o) => o.id === ref.id)?.rotation ?? 0
        default:
            return 0
    }
}

/**
 * Oriente un élément : angle absolu pour les éléments rectangulaires ; pour
 * une porte ou une cloison, rotation du segment autour de son milieu.
 */
export function setRotation(floor: FloorLayout, ref: ElementRef, degrees: number): FloorLayout {
    const rotation = normalizeAngle(degrees)
    const apply = <T extends { id: string; rotation?: number }>(list: T[]) =>
        list.map((item) => (item.id === ref.id ? { ...item, rotation: rotation || undefined } : item))
    switch (ref.kind) {
        case "rack":
            return { ...floor, racks: apply(floor.racks) }
        case "fixture":
            return { ...floor, fixtures: apply(floor.fixtures) }
        case "office":
            return { ...floor, offices: apply(floor.offices) }
        default:
            return rotateBy(floor, ref, degrees - segmentAngle(floor, ref))
    }
}

/** Angle d'un segment (porte, cloison), en degrés. */
export function segmentAngle(floor: FloorLayout, ref: ElementRef): number {
    const seg = segmentOf(floor, ref)
    if (!seg) return 0
    const [[x1, z1], [x2, z2]] = seg
    return normalizeAngle((Math.atan2(z2 - z1, x2 - x1) * 180) / Math.PI)
}

/** Tourne un élément de `degrees` (sens horaire sur le plan). */
export function rotateBy(floor: FloorLayout, ref: ElementRef, degrees: number): FloorLayout {
    if (ANGLED_KINDS.has(ref.kind)) {
        return setRotation(floor, ref, elementRotation(floor, ref) + degrees)
    }
    if (ref.kind !== "door" && ref.kind !== "wall") return floor
    const turn = (from: [number, number], to: [number, number]) => {
        const mx = (from[0] + to[0]) / 2
        const mz = (from[1] + to[1]) / 2
        const pivot = ([x, z]: [number, number]): [number, number] => {
            const p = rotatePoint(x, z, mx, mz, degrees)
            return [round(p.x), round(p.z)]
        }
        return { from: pivot(from), to: pivot(to) }
    }
    return ref.kind === "door"
        ? { ...floor, doors: floor.doors.map((d) => (d.id === ref.id ? { ...d, ...turn(d.from, d.to) } : d)) }
        : { ...floor, innerWalls: floor.innerWalls.map((w) => (w.id === ref.id ? { ...w, ...turn(w.from, w.to) } : w)) }
}
