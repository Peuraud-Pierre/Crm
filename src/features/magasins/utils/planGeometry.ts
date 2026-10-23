import type { PlanGeometry, PlanItem, PlanItemKind, ZoneKind } from "@/features/magasins/types/magasin.types"

/** Rectangle en mètres, dans le repère du magasin. */
export interface Rect {
    x: number
    y: number
    w: number
    h: number
}

export interface Bounds {
    width: number
    depth: number
}

/** Pas de la grille d'édition : 10 cm. */
export const SNAP = 0.1
/** Plus petit côté autorisé dans l'éditeur. */
export const MIN_SIDE = 0.2

/** Taille proposée à la première pose, selon le type d'élément. */
export const DEFAULT_SIZE: Record<PlanItemKind, { w: number; h: number }> = {
    zone: { w: 5, h: 4 },
    rayon: { w: 4, h: 1 },
    // Portant de boutique : 1,5 m de barre, 60 cm de vêtements.
    etagere: { w: 1.5, h: 0.6 },
    emplacement: { w: 1, h: 0.6 },
    // Comptoir de caisse ; portes : largeur de passage × épaisseur de mur.
    caisse: { w: 1.6, h: 0.7 },
    entree: { w: 1.4, h: 0.2 },
    sortie: { w: 1.4, h: 0.2 },
    entree_sortie: { w: 2, h: 0.2 },
    // Volée droite : 1 m de passage, 3 m de long (une douzaine de marches).
    escalier: { w: 1, h: 3 },
    // Colimaçon courant de boutique : 1,60 m de diamètre.
    escalier_colimacon: { w: 1.6, h: 1.6 },
    // Mannequin sur son socle : largeur d'épaules × profondeur.
    mannequin: { w: 0.5, h: 0.35 },
}

/** Hauteur des volumes de la vue 3D, en mètres. */
export const HEIGHT_3D: Record<PlanItemKind, number> = {
    zone: 0.02,
    rayon: 1.4,
    // Portant : hauteur de sa barre (voir components/plan/scene/portant.ts).
    etagere: 1.6,
    emplacement: 0.9,
    caisse: 1.0,
    entree: 2.1,
    sortie: 2.1,
    entree_sortie: 2.1,
    // Monte à l'étage du dessus (hauteur sous plafond d'une boutique).
    escalier: 2.8,
    escalier_colimacon: 2.8,
    mannequin: 1.8,
}

export function snap(value: number): number {
    // Arrondi final au centimètre : 12 × 0,1 donne 1,2000000000000002 en
    // virgule flottante, qui s'afficherait tel quel dans les champs.
    return Math.round(Math.round(value / SNAP) * SNAP * 100) / 100
}

const round2 = (value: number) => Math.round(value * 100) / 100

export function rectOf(geometry: PlanGeometry): Rect | null {
    const { pos_x, pos_y, width, height } = geometry
    if (pos_x == null || pos_y == null || width == null || height == null) return null
    return { x: pos_x, y: pos_y, w: width, h: height }
}

export function geometryOf(rect: Rect | null, rotation = 0): PlanGeometry {
    if (!rect) return { pos_x: null, pos_y: null, width: null, height: null, rotation: 0 }
    return {
        pos_x: round2(rect.x),
        pos_y: round2(rect.y),
        width: round2(rect.w),
        height: round2(rect.h),
        rotation: normalizeRotation(rotation),
    }
}

export function normalizeRotation(deg: number): number {
    const r = ((Math.round(deg) % 360) + 360) % 360
    return r
}

/** Garde le rectangle dans l'emprise du magasin, côtés au minimum MIN_SIDE. */
/**
 * Garde l'élément dans le magasin. C'est son emprise réelle qui compte : une
 * porte tournée de 90° n'est plus large que de son épaisseur, et doit pouvoir
 * se coller au mur de droite ou de gauche.
 */
export function clampRect(rect: Rect, bounds: Bounds, rotation = 0): Rect {
    const w = Math.min(Math.max(rect.w, MIN_SIDE), bounds.width)
    const h = Math.min(Math.max(rect.h, MIN_SIDE), bounds.depth)
    const a = (rotation * Math.PI) / 180
    const cos = Math.abs(Math.cos(a))
    const sin = Math.abs(Math.sin(a))
    // Demi-emprise de l'élément tourné, bornée à la moitié du magasin.
    const ex = Math.min((w * cos + h * sin) / 2, bounds.width / 2)
    const ey = Math.min((w * sin + h * cos) / 2, bounds.depth / 2)
    const cx = Math.min(Math.max(rect.x + w / 2, ex), bounds.width - ex)
    const cy = Math.min(Math.max(rect.y + h / 2, ey), bounds.depth - ey)
    return { x: round2(cx - w / 2), y: round2(cy - h / 2), w: round2(w), h: round2(h) }
}

export function moveRect(rect: Rect, dx: number, dy: number, bounds: Bounds, rotation = 0): Rect {
    return clampRect({ ...rect, x: snap(rect.x + dx), y: snap(rect.y + dy) }, bounds, rotation)
}

/**
 * Première pose d'un élément : au centre de son parent s'il est placé, sinon
 * au centre du magasin.
 */
export function initialRect(kind: PlanItemKind, bounds: Bounds, parent?: Rect | null): Rect {
    const size = DEFAULT_SIZE[kind]
    const area = parent ?? { x: 0, y: 0, w: bounds.width, h: bounds.depth }
    const w = Math.min(size.w, area.w)
    const h = Math.min(size.h, area.h)
    return clampRect(
        { x: snap(area.x + (area.w - w) / 2), y: snap(area.y + (area.h - h) / 2), w, h },
        bounds,
    )
}

/** Deux géométries enregistrées identiques ? (comparaison au centimètre) */
export function sameGeometry(a: PlanGeometry, b: PlanGeometry): boolean {
    const eq = (u: number | null, v: number | null) =>
        u == null || v == null ? u === v : Math.abs(u - v) < 0.005
    return (
        eq(a.pos_x, b.pos_x) &&
        eq(a.pos_y, b.pos_y) &&
        eq(a.width, b.width) &&
        eq(a.height, b.height) &&
        normalizeRotation(a.rotation) === normalizeRotation(b.rotation)
    )
}

/**
 * Zone, rayon ou portant placé le plus petit qui contient le centre du
 * rectangle : le parent proposé pour une zone dessinée à cet endroit.
 * La rotation des conteneurs est ignorée (approximation suffisante pour une
 * proposition que l'utilisateur confirme).
 */
export function containingZone(rect: Rect, items: readonly PlanItem[]): PlanItem | null {
    const cx = rect.x + rect.w / 2
    const cy = rect.y + rect.h / 2
    let best: PlanItem | null = null
    let bestArea = Infinity
    for (const item of items) {
        if (item.type !== "zone") continue
        const r = rectOf(item.geometry)
        if (!r || cx < r.x || cx > r.x + r.w || cy < r.y || cy > r.y + r.h) continue
        if (r.w * r.h < bestArea) {
            best = item
            bestArea = r.w * r.h
        }
    }
    return best
}

/** Niveau proposé pour une zone dessinée dans `parent` : un cran en dessous. */
export function drawnKind(parent: PlanItem | null): ZoneKind {
    if (!parent) return "zone"
    return parent.kind === "zone" ? "rayon" : "etagere"
}

/** Plus petite largeur du plan importé au calage, en mètres. */
export const MIN_FOND_WIDTH = 1

/**
 * Déplacement du plan importé. Pas de bornage à l'emprise du magasin : un plan
 * d'architecte a des marges et un cartouche, qui débordent légitimement.
 * Arrondi au centimètre : le calage se fait plus finement que la grille.
 */
export function moveFond(rect: Rect, dx: number, dy: number): Rect {
    return { ...rect, x: round2(rect.x + dx), y: round2(rect.y + dy) }
}

/**
 * Redimensionnement du plan importé par son coin bas-droit, proportions
 * gardées (sans quoi le décalque serait faux) : la largeur suit le pointeur,
 * la profondeur en découle.
 */
export function resizeFond(rect: Rect, dx: number): Rect {
    const ratio = rect.w / rect.h
    const w = Math.max(MIN_FOND_WIDTH, rect.w + dx)
    return { ...rect, w: round2(w), h: round2(w / ratio) }
}

/** Poignée de redimensionnement : un coin ou un côté (points cardinaux). */
export type ResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw"

export const RESIZE_HANDLES: readonly ResizeHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"]

/** Position d'une poignée sur le rectangle (non tourné), en fractions 0 / 0,5 / 1. */
export function handleAnchor(handle: ResizeHandle): { u: number; v: number } {
    return {
        u: handle.includes("w") ? 0 : handle.includes("e") ? 1 : 0.5,
        v: handle.includes("n") ? 0 : handle.includes("s") ? 1 : 0.5,
    }
}

/**
 * Redimensionne par une poignée quelconque. `dx`, `dy` : déplacement du
 * pointeur dans le repère du plan. Pour un élément tourné, le déplacement est
 * ramené dans ses axes, puis le centre est recalé pour que le côté opposé à la
 * poignée ne bouge pas à l'écran (la rotation se fait autour du centre).
 */
export function resizeByHandle(
    rect: Rect,
    rotation: number,
    handle: ResizeHandle,
    dx: number,
    dy: number,
    bounds: Bounds,
): Rect {
    const a = (rotation * Math.PI) / 180
    const cos = Math.cos(a)
    const sin = Math.sin(a)
    // Déplacement dans les axes de l'élément.
    const lx = dx * cos + dy * sin
    const ly = -dx * sin + dy * cos

    let left = -rect.w / 2
    let right = rect.w / 2
    let top = -rect.h / 2
    let bottom = rect.h / 2
    if (handle.includes("e")) right = Math.max(left + MIN_SIDE, right + lx)
    if (handle.includes("w")) left = Math.min(right - MIN_SIDE, left + lx)
    if (handle.includes("s")) bottom = Math.max(top + MIN_SIDE, bottom + ly)
    if (handle.includes("n")) top = Math.min(bottom - MIN_SIDE, top + ly)

    const w = snap(right - left)
    const h = snap(bottom - top)
    // Décalage du centre, dans les axes de l'élément, puis dans ceux du plan.
    const ox = (left + right) / 2
    const oy = (top + bottom) / 2
    const cx = rect.x + rect.w / 2 + ox * cos - oy * sin
    const cy = rect.y + rect.h / 2 + ox * sin + oy * cos
    return clampRect({ x: round2(cx - w / 2), y: round2(cy - h / 2), w, h }, bounds, rotation)
}
