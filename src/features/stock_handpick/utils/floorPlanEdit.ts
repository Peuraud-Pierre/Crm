import { DEFAULT_FLOOR, type FloorLayout, type Rect } from "./floorPlan"
import { PLAN_ROWS, type PlanRow, type PlanZoneCode } from "./planLayout"

/**
 * Opérations d'édition du plan d'étage — fonctions PURES : elles rendent une
 * nouvelle disposition sans toucher à celle reçue, ce qui permet à l'éditeur
 * de repartir de la disposition d'origine à chaque pas d'un glisser.
 */

/** Familles d'éléments du plan, chacune rangée dans sa collection. */
export type ElementKind =
    | "rack" | "fixture" | "office" | "zone" | "pillar" | "door" | "wall" | "baleSpot"

export interface ElementRef {
    kind: ElementKind
    id: string
}

/** Pas de la grille d'accroche, en mètres. */
export const SNAP = 0.1

export const snap = (value: number) => Math.round(value / SNAP) * SNAP
export const round = (value: number) => Math.round(value * 100) / 100

/** Taille minimale d'un rectangle, pour qu'il reste saisissable. */
const MIN_SIZE = 0.2

/** Éléments définis par un rectangle : déplaçables ET redimensionnables. */
export const RECT_KINDS: ReadonlySet<ElementKind> = new Set(["rack", "fixture", "office", "zone"])

/** Éléments qu'on ne peut pas supprimer : les zones et leurs points de dépose. */
export const FIXED_KINDS: ReadonlySet<ElementKind> = new Set(["zone", "baleSpot"])

export const ELEMENT_KIND_LABELS: Record<ElementKind, string> = {
    rack: "Rack",
    fixture: "Aménagement",
    office: "Bureau",
    zone: "Zone",
    pillar: "Colonne",
    door: "Porte",
    wall: "Cloison",
    baleSpot: "Dépose des balles",
}

// ─── Lecture ─────────────────────────────────────────────────────────────────

/** Rectangle d'un élément rectangulaire, ou `null`. */
export function elementRect(floor: FloorLayout, ref: ElementRef): Rect | null {
    switch (ref.kind) {
        case "rack":
            return floor.racks.find((r) => r.id === ref.id)?.rect ?? null
        case "fixture":
            return floor.fixtures.find((f) => f.id === ref.id)?.rect ?? null
        case "office":
            return floor.offices.find((o) => o.id === ref.id)?.rect ?? null
        case "zone":
            return floor.zones[ref.id as PlanZoneCode] ?? null
        default:
            return null
    }
}

/** Boîte englobante de n'importe quel élément, pour le surligner. */
export function elementBounds(floor: FloorLayout, ref: ElementRef): Rect | null {
    const rect = elementRect(floor, ref)
    if (rect) return rect
    const pad = 0.35
    switch (ref.kind) {
        case "pillar": {
            const p = floor.pillars.find((x) => x.id === ref.id)
            return p ? { x: p.x - pad, z: p.z - pad, w: pad * 2, d: pad * 2 } : null
        }
        case "baleSpot": {
            const p = floor.baleSpots[ref.id as "A" | "D"]
            return p ? { x: p.x - 1.2, z: p.z - 0.8, w: 2.4, d: 1.6 } : null
        }
        case "door":
        case "wall": {
            const seg = segmentOf(floor, ref)
            if (!seg) return null
            const [[x1, z1], [x2, z2]] = seg
            return {
                x: Math.min(x1, x2) - pad,
                z: Math.min(z1, z2) - pad,
                w: Math.abs(x2 - x1) + pad * 2,
                d: Math.abs(z2 - z1) + pad * 2,
            }
        }
        default:
            return null
    }
}

function segmentOf(floor: FloorLayout, ref: ElementRef): [[number, number], [number, number]] | null {
    const list = ref.kind === "door" ? floor.doors : ref.kind === "wall" ? floor.innerWalls : []
    const item = list.find((x) => x.id === ref.id)
    return item ? [item.from, item.to] : null
}

export function elementExists(floor: FloorLayout, ref: ElementRef): boolean {
    return elementBounds(floor, ref) !== null
}

// ─── Modifications ───────────────────────────────────────────────────────────

const moveRect = (rect: Rect, dx: number, dz: number): Rect => ({
    ...rect,
    x: round(snap(rect.x + dx)),
    z: round(snap(rect.z + dz)),
})

const movePoint = ([x, z]: [number, number], dx: number, dz: number): [number, number] => [
    round(snap(x + dx)),
    round(snap(z + dz)),
]

/** Applique `patch` au rectangle d'un élément rectangulaire. */
export function updateRect(floor: FloorLayout, ref: ElementRef, patch: (rect: Rect) => Rect): FloorLayout {
    switch (ref.kind) {
        case "rack":
            return { ...floor, racks: floor.racks.map((r) => (r.id === ref.id ? { ...r, rect: patch(r.rect) } : r)) }
        case "fixture":
            return {
                ...floor,
                fixtures: floor.fixtures.map((f) => (f.id === ref.id ? { ...f, rect: patch(f.rect) } : f)),
            }
        case "office":
            return {
                ...floor,
                offices: floor.offices.map((o) => (o.id === ref.id ? { ...o, rect: patch(o.rect) } : o)),
            }
        case "zone": {
            const zone = ref.id as PlanZoneCode
            return { ...floor, zones: { ...floor.zones, [zone]: patch(floor.zones[zone]) } }
        }
        default:
            return floor
    }
}

/** Déplace un élément de (dx, dz) mètres, avec accroche à la grille. */
export function moveElement(floor: FloorLayout, ref: ElementRef, dx: number, dz: number): FloorLayout {
    if (RECT_KINDS.has(ref.kind)) return updateRect(floor, ref, (rect) => moveRect(rect, dx, dz))
    switch (ref.kind) {
        case "pillar":
            return {
                ...floor,
                pillars: floor.pillars.map((p) => {
                    if (p.id !== ref.id) return p
                    const [x, z] = movePoint([p.x, p.z], dx, dz)
                    return { ...p, x, z }
                }),
            }
        case "baleSpot": {
            const key = ref.id as "A" | "D"
            const [x, z] = movePoint([floor.baleSpots[key].x, floor.baleSpots[key].z], dx, dz)
            return { ...floor, baleSpots: { ...floor.baleSpots, [key]: { x, z } } }
        }
        case "door":
            return {
                ...floor,
                doors: floor.doors.map((d) =>
                    d.id === ref.id ? { ...d, from: movePoint(d.from, dx, dz), to: movePoint(d.to, dx, dz) } : d,
                ),
            }
        case "wall":
            return {
                ...floor,
                innerWalls: floor.innerWalls.map((w) =>
                    w.id === ref.id ? { ...w, from: movePoint(w.from, dx, dz), to: movePoint(w.to, dx, dz) } : w,
                ),
            }
        default:
            return floor
    }
}

/** Redimensionne un élément rectangulaire depuis son coin haut-gauche. */
export function resizeElement(floor: FloorLayout, ref: ElementRef, w: number, d: number): FloorLayout {
    return updateRect(floor, ref, (rect) => ({
        ...rect,
        w: round(Math.max(MIN_SIZE, snap(w))),
        d: round(Math.max(MIN_SIZE, snap(d))),
    }))
}

/**
 * Tourne un élément rectangulaire d'un quart de tour autour de son centre :
 * largeur et profondeur s'échangent, et l'axe des meubles orientables suit.
 */
export function rotateElement(floor: FloorLayout, ref: ElementRef): FloorLayout {
    const turn = (rect: Rect): Rect => {
        const cx = rect.x + rect.w / 2
        const cz = rect.z + rect.d / 2
        return {
            x: round(snap(cx - rect.d / 2)),
            z: round(snap(cz - rect.w / 2)),
            w: rect.d,
            d: rect.w,
        }
    }
    const flip = (axis: "x" | "z" | undefined) => (axis === "z" ? "x" : "z") as "x" | "z"
    switch (ref.kind) {
        case "rack":
            return {
                ...floor,
                racks: floor.racks.map((r) => (r.id === ref.id ? { ...r, rect: turn(r.rect), axis: flip(r.axis) } : r)),
            }
        case "fixture":
            return {
                ...floor,
                fixtures: floor.fixtures.map((f) =>
                    f.id === ref.id ? { ...f, rect: turn(f.rect), axis: flip(f.axis) } : f,
                ),
            }
        case "office":
        case "zone":
            return updateRect(floor, ref, turn)
        case "door":
        case "wall": {
            // Segment : pivote autour de son milieu.
            const rotate = (from: [number, number], to: [number, number]) => {
                const mx = (from[0] + to[0]) / 2
                const mz = (from[1] + to[1]) / 2
                const pivot = ([x, z]: [number, number]): [number, number] => [
                    round(snap(mx - (z - mz))),
                    round(snap(mz + (x - mx))),
                ]
                return { from: pivot(from), to: pivot(to) }
            }
            return ref.kind === "door"
                ? { ...floor, doors: floor.doors.map((d) => (d.id === ref.id ? { ...d, ...rotate(d.from, d.to) } : d)) }
                : {
                      ...floor,
                      innerWalls: floor.innerWalls.map((w) =>
                          w.id === ref.id ? { ...w, ...rotate(w.from, w.to) } : w,
                      ),
                  }
        }
        default:
            return floor
    }
}

export function removeElement(floor: FloorLayout, ref: ElementRef): FloorLayout {
    switch (ref.kind) {
        case "rack":
            return { ...floor, racks: floor.racks.filter((r) => r.id !== ref.id) }
        case "fixture":
            return { ...floor, fixtures: floor.fixtures.filter((f) => f.id !== ref.id) }
        case "office":
            return { ...floor, offices: floor.offices.filter((o) => o.id !== ref.id) }
        case "pillar":
            return { ...floor, pillars: floor.pillars.filter((p) => p.id !== ref.id) }
        case "door":
            return { ...floor, doors: floor.doors.filter((d) => d.id !== ref.id) }
        case "wall":
            return { ...floor, innerWalls: floor.innerWalls.filter((w) => w.id !== ref.id) }
        default:
            // Zones et points de dépose : structurels, jamais supprimés.
            return floor
    }
}

/** Modifie les propriétés non géométriques d'un élément (libellé, rangée…). */
export function updateElement(
    floor: FloorLayout,
    ref: ElementRef,
    patch: Record<string, unknown>,
): FloorLayout {
    const apply = <T extends { id: string }>(list: T[]) =>
        list.map((item) => (item.id === ref.id ? ({ ...item, ...patch } as T) : item))
    switch (ref.kind) {
        case "rack":
            return { ...floor, racks: apply(floor.racks) }
        case "fixture":
            return { ...floor, fixtures: apply(floor.fixtures) }
        case "office":
            return { ...floor, offices: apply(floor.offices) }
        case "door":
            return { ...floor, doors: apply(floor.doors) }
        case "wall":
            return { ...floor, innerWalls: apply(floor.innerWalls) }
        default:
            return floor
    }
}

// ─── Rangées adressables ─────────────────────────────────────────────────────

/** Rangées encore libres (aucun rack du plan ne les porte). */
export function freeRows(floor: FloorLayout, keep?: PlanRow | null): PlanRow[] {
    const used = new Set(floor.racks.map((r) => r.row).filter(Boolean))
    return PLAN_ROWS.filter((row) => row === keep || !used.has(row))
}

// ─── Lecture d'une disposition enregistrée ───────────────────────────────────

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/**
 * Relit une disposition venue de la base. Tolérante : une clé absente ou d'un
 * mauvais type retombe sur la valeur par défaut, pour qu'un enregistrement
 * ancien ou partiel ne casse jamais l'écran.
 */
export function normalizeLayout(raw: unknown): FloorLayout {
    if (!isObject(raw)) return DEFAULT_FLOOR
    const pick = <K extends keyof FloorLayout>(key: K, check: (v: unknown) => boolean): FloorLayout[K] =>
        check(raw[key]) ? (raw[key] as FloorLayout[K]) : DEFAULT_FLOOR[key]
    const zones = isObject(raw.zones) ? raw.zones : {}
    const spots = isObject(raw.baleSpots) ? raw.baleSpots : {}
    return {
        width: pick("width", (v) => typeof v === "number"),
        depth: pick("depth", (v) => typeof v === "number"),
        outline: pick("outline", Array.isArray),
        zones: {
            A: isObject(zones.A) ? (zones.A as unknown as Rect) : DEFAULT_FLOOR.zones.A,
            B: isObject(zones.B) ? (zones.B as unknown as Rect) : DEFAULT_FLOOR.zones.B,
            D: isObject(zones.D) ? (zones.D as unknown as Rect) : DEFAULT_FLOOR.zones.D,
        },
        racks: pick("racks", Array.isArray),
        offices: pick("offices", Array.isArray),
        doors: pick("doors", Array.isArray),
        fixtures: pick("fixtures", Array.isArray),
        baleSpots: {
            A: isObject(spots.A) ? (spots.A as FloorLayout["baleSpots"]["A"]) : DEFAULT_FLOOR.baleSpots.A,
            D: isObject(spots.D) ? (spots.D as FloorLayout["baleSpots"]["D"]) : DEFAULT_FLOOR.baleSpots.D,
        },
        pillars: pick("pillars", Array.isArray),
        innerWalls: pick("innerWalls", Array.isArray),
        plane: pick("plane", isObject),
    }
}

// Angle libre : voir `floorPlanRotation.ts`, réexporté ici pour l'éditeur.
export {
    ANGLED_KINDS,
    elementRotation,
    normalizeAngle,
    rotateBy,
    segmentAngle,
    setRotation,
} from "./floorPlanRotation"
