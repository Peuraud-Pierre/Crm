import { rotatePoint, type FloorLayout, type Rect } from "./floorPlan"
import type { FixtureKind } from "./floorPlan"

/**
 * Collisions du visiteur de la promenade 3D, sur le plan (x, z) en mètres.
 *
 * Le visiteur est un disque de rayon `radius`. Il doit rester dans le
 * contour du bâtiment et ne traverser ni racks, ni meubles, ni bureaux, ni
 * colonnes, ni cloisons. Fonctions PURES : la scène ne fait que les appeler.
 */

export type Obstacle =
    | { kind: "rect"; rect: Rect; rotation: number }
    | { kind: "circle"; x: number; z: number; r: number }
    | { kind: "segment"; from: [number, number]; to: [number, number]; thickness: number }

/** Meubles sur lesquels on peut marcher. */
const WALKABLE: ReadonlySet<FixtureKind> = new Set(["walkway"])

/** Rayon d'une colonne EPV (socle compris). */
const PILLAR_RADIUS = 0.3

export function walkObstacles(floor: FloorLayout): Obstacle[] {
    const rects: Obstacle[] = [
        ...floor.racks.map((r) => ({ kind: "rect" as const, rect: r.rect, rotation: r.rotation ?? 0 })),
        ...floor.offices.map((o) => ({ kind: "rect" as const, rect: o.rect, rotation: o.rotation ?? 0 })),
        ...floor.fixtures
            .filter((f) => !WALKABLE.has(f.kind))
            .map((f) => ({ kind: "rect" as const, rect: f.rect, rotation: f.rotation ?? 0 })),
    ]
    const pillars: Obstacle[] = floor.pillars.map((p) => ({ kind: "circle", x: p.x, z: p.z, r: PILLAR_RADIUS }))
    const walls: Obstacle[] = floor.innerWalls.map((w) => ({
        kind: "segment",
        from: w.from,
        to: w.to,
        thickness: 0.15,
    }))
    return [...rects, ...pillars, ...walls]
}

/** Distance d'un point à un segment. */
export function distanceToSegment(px: number, pz: number, [ax, az]: [number, number], [bx, bz]: [number, number]): number {
    const dx = bx - ax
    const dz = bz - az
    const lengthSq = dx * dx + dz * dz
    const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / lengthSq))
    return Math.hypot(px - (ax + t * dx), pz - (az + t * dz))
}

/** Point dans un polygone (règle pair-impair). */
export function insidePolygon(px: number, pz: number, polygon: [number, number][]): boolean {
    let inside = false
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const [xi, zi] = polygon[i]
        const [xj, zj] = polygon[j]
        if (zi > pz !== zj > pz && px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi) inside = !inside
    }
    return inside
}

function hits(x: number, z: number, radius: number, obstacle: Obstacle): boolean {
    switch (obstacle.kind) {
        case "circle":
            return Math.hypot(x - obstacle.x, z - obstacle.z) < radius + obstacle.r
        case "segment":
            return distanceToSegment(x, z, obstacle.from, obstacle.to) < radius + obstacle.thickness / 2
        case "rect": {
            const { rect, rotation } = obstacle
            const cx = rect.x + rect.w / 2
            const cz = rect.z + rect.d / 2
            // Point ramené dans le repère non tourné du rectangle.
            const local = rotatePoint(x, z, cx, cz, -rotation)
            const nearestX = Math.max(rect.x, Math.min(local.x, rect.x + rect.w))
            const nearestZ = Math.max(rect.z, Math.min(local.z, rect.z + rect.d))
            return Math.hypot(local.x - nearestX, local.z - nearestZ) < radius
        }
    }
}

/** Vrai si le visiteur peut se tenir en (x, z). */
export function isFree(
    x: number,
    z: number,
    radius: number,
    obstacles: Obstacle[],
    outline: [number, number][],
): boolean {
    if (!insidePolygon(x, z, outline)) return false
    for (let i = 0; i < outline.length; i++) {
        if (distanceToSegment(x, z, outline[i], outline[(i + 1) % outline.length]) < radius) return false
    }
    return !obstacles.some((obstacle) => hits(x, z, radius, obstacle))
}

/**
 * Avance de (dx, dz) en glissant le long des obstacles : déplacement complet
 * si possible, sinon sur un seul axe, sinon immobile.
 */
export function stepWalker(
    position: { x: number; z: number },
    dx: number,
    dz: number,
    radius: number,
    obstacles: Obstacle[],
    outline: [number, number][],
): { x: number; z: number } {
    const tries: [number, number][] = [[dx, dz], [dx, 0], [0, dz]]
    for (const [mx, mz] of tries) {
        if (mx === 0 && mz === 0) continue
        const x = position.x + mx
        const z = position.z + mz
        if (isFree(x, z, radius, obstacles, outline)) return { x, z }
    }
    return position
}

/**
 * Point de départ de la visite : un peu à l'intérieur de l'entrée de la
 * boutique, à défaut le premier point libre au centre de la zone D.
 */
export function walkStart(floor: FloorLayout, radius: number): { x: number; z: number } {
    const obstacles = walkObstacles(floor)
    const door = floor.doors.find((d) => d.id === "porte-boutique") ?? floor.doors[0]
    const candidates: { x: number; z: number }[] = []
    if (door) {
        const mx = (door.from[0] + door.to[0]) / 2
        const mz = (door.from[1] + door.to[1]) / 2
        // Vers l'intérieur : on essaie les deux côtés de la porte.
        for (const inset of [1.2, 2, 3]) {
            candidates.push({ x: mx, z: mz - inset }, { x: mx, z: mz + inset })
        }
    }
    const d = floor.zones.D
    for (let i = 0; i < 40; i++) {
        candidates.push({ x: d.x + d.w / 2 + ((i % 5) - 2), z: d.z + d.d / 2 + (Math.floor(i / 5) - 4) })
    }
    return (
        candidates.find((p) => isFree(p.x, p.z, radius, obstacles, floor.outline)) ?? {
            x: d.x + d.w / 2,
            z: d.z + d.d / 2,
        }
    )
}
