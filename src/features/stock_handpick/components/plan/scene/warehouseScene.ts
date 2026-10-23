/**
 * Décor 3D de l'entrepôt handpick — Three.js brut, sans r3f (même choix que
 * `features/tournee/components/Board3D.tsx`).
 *
 * La DISPOSITION vient de `utils/floorPlan.ts` (plan d'étage relevé au
 * tableau), partagé avec la vue 2D. L'APPARENCE vient des photos du site :
 *  • racks à palettes : montants bleus, lisses orange, planchers en lattes,
 *    sacs verts et sacs plastique transparents ;
 *  • boutique (`shopParts.ts`) : sol blanc brillant, portants muraux sous
 *    étagère garnie, îlots à plateau bois entre deux rangées de colonnes,
 *    sacs verts sur palette, tables de t-shirts, avion suspendu ;
 *  • annexe : estrade en OSB bordée de rouge, sacs empilés ;
 *  • colonnes noires en fonte sur socle rouge « EPV ».
 * Bureaux vitrés bleutés et portes noires reprennent le code couleur du plan.
 *
 * Les murs sont en coupe (hauteur réduite) pour qu'on voie à l'intérieur.
 *
 * Exception design system §12.4 (« couleurs d'assets non tokenisables ») pour
 * tout le fichier : matériaux three.js et contextes canvas 2D n'acceptent que
 * des valeurs littérales. Le décor reproduit un lieu réel, il est volontairement
 * indépendant du thème clair / sombre.
 */
/* eslint-disable nokk-project/no-restricted-syntax */
import * as THREE from "three"
import {
    C,
    balePile,
    box,
    epvTexture,
    makeLabel,
    mat,
    palletMesh,
    pillar,
} from "./sceneParts"
import { hangingPlane } from "./shopParts"
import {
    PLAN_ROW_LABELS,
    isPalletShelf,
    isPlanShelf,
    rowBays,
    shelfLevels,
    PLAN_ZONES,
    type PlanLevel,
    type PlanRow,
    type PlanShelf,
    type PlanZoneCode,
} from "@/features/stock_handpick/utils/planLayout"
import {
    bayRects,
    rotatePoint,
    type FloorLayout,
    type DoorSpec,
    type RackSpec,
} from "@/features/stock_handpick/utils/floorPlan"

import { MASCOT_RATIO, center, fixture, innerWall, mascotTexture, office, signTexture, wallHooks, yaw } from "./fixtures"
import { shoeShelf } from "./annexParts"
import { PILE_CAPACITY } from "@/features/stock_handpick/utils/pileLayout"
import type { PlanFocus } from "@/features/stock_handpick/utils/planFocus"
import { outlineCutaway, type CutawayMeta } from "./cutaway"

export { SITE, disposeMaterialCache, disposeObject } from "./sceneParts"

// ─── Dimensions ──────────────────────────────────────────────────────────────

const RACK_H = 4.6
/** Hauteur du plancher de chaque niveau ; H0 est la palette au sol. */
const LEVEL_Y: Record<PlanLevel, number> = { H0: 0.14, H1: 1.75, H2: 3.35 }
/** Hauteur du volume cliquable d'une palette au sol (sans rack). */
const PALLET_HIT_H = 1.6
/** Cloisons intérieures en coupe : assez hautes pour se lire, assez basses pour voir dedans. */
const WALL_H = 2.4
/**
 * Murs extérieurs pleine hauteur, au-dessus des racks (RACK_H). Ceux du côté
 * de la caméra sont masqués par la vue en coupe (`cutaway.ts`) : on voit
 * dedans, et les murs du fond ferment la scène.
 */
const OUTER_WALL_H = 5.2
const WALL_T = 0.2
const DOOR_H = 2.3

const ZONE_LABEL_ACCENT: Record<PlanZoneCode, string> = {
    B: "#dc2626",
    A: "#6b7280",
    D: "#111827",
}

export interface BayHit {
    row: PlanRow
    shelf: PlanShelf
}

// ─── Racks ───────────────────────────────────────────────────────────────────

/**
 * Un rack, construit dans un repère local (longueur sur x, profondeur sur z,
 * origine au centre) puis tourné si le rack court selon z. Seuls les racks adressables portent des volumes de
 * sélection, un par travée.
 */
function rack(spec: RackSpec, hits: THREE.Mesh[]): THREE.Group {
    if (spec.style === "shoes") {
        const along = spec.axis === "x"
        const shelf = shoeShelf(along ? spec.rect.w : spec.rect.d, along ? spec.rect.d : spec.rect.w, Math.round(spec.rect.z * 10))
        const c = center(spec.rect)
        shelf.position.set(c.x, 0, c.z)
        shelf.rotation.y = yaw(along, spec.rotation)
        return shelf
    }
    const group = new THREE.Group()
    const blue = mat(C.rackBlue, { roughness: 0.45, metalness: 0.3 })
    const orange = mat(C.beamOrange, { roughness: 0.5, metalness: 0.2 })
    const slat = mat(C.slat)
    const brace = mat(C.brace, { metalness: 0.5, roughness: 0.4 })

    const along = spec.axis === "x"
    const length = along ? spec.rect.w : spec.rect.d
    const depth = along ? spec.rect.d : spec.rect.w
    const row = spec.row
    const codes = row ? rowBays(row) : []
    const bays = row ? codes.length : Math.max(1, Math.round(length / 2.7))
    const bayW = length / bays
    const x0 = -length / 2
    // Travée démontée (R1/E4) : un trou — ni lisses, ni plancher, ni
    // palette. Les montants qui le bordent restent : ils portent ses voisines.
    const isHole = (i: number) => (row ? !isPlanShelf(row, codes[i]) : false)
    // Palette au sol (R2-R3/E1-E2) : la palette seule, sans rack autour.
    const isPallet = (i: number) => (row ? isPalletShelf(row, codes[i]) : false)

    for (let i = 0; i <= bays; i++) {
        // Montant seulement s'il porte au moins une travée de rack à côté.
        const racked = (j: number) => j >= 0 && j < bays && !isPallet(j)
        if (!racked(i - 1) && !racked(i)) continue
        const x = x0 + i * bayW
        for (const side of [-1, 1]) {
            group.add(box(0.09, RACK_H, 0.09, blue, x, RACK_H / 2, (side * depth) / 2))
        }
        for (let k = 0; k < 3; k++) {
            const diagonal = box(0.03, 1.7, 0.03, brace, x, 0.9 + k * 1.45, 0)
            diagonal.rotation.x = k % 2 === 0 ? 0.55 : -0.55
            group.add(diagonal)
        }
    }
    // Lisses et planchers travée par travée, pour pouvoir sauter le trou.
    for (let i = 0; i < bays; i++) {
        if (isHole(i)) continue
        const cx = x0 + i * bayW + bayW / 2
        if (isPallet(i)) {
            group.add(palletMesh(cx, 0, Math.min(1.2, bayW - 0.3), depth - 0.15))
            continue
        }
        for (const level of ["H1", "H2"] as const) {
            const y = LEVEL_Y[level]
            for (const side of [-1, 1]) {
                group.add(box(bayW, 0.13, 0.06, orange, cx, y - 0.06, (side * depth) / 2))
            }
            group.add(box(bayW - 0.1, 0.04, depth, slat, cx, y + 0.02, 0))
        }
        for (const side of [-1, 1]) {
            group.add(box(bayW, 0.1, 0.05, orange, cx, RACK_H - 0.15, (side * depth) / 2))
        }
        group.add(palletMesh(cx, 0, Math.min(1.2, bayW - 0.3), depth - 0.15))
    }

    if (spec.row) {
        for (let i = 0; i < bays; i++) {
            const bay = codes[i]
            if (!isPlanShelf(spec.row, bay)) continue
            // Palette au sol : volume bas, à hauteur de la pile de balles.
            const hitH = isPallet(i) ? PALLET_HIT_H : RACK_H
            const hit = new THREE.Mesh(
                new THREE.BoxGeometry(bayW - 0.08, hitH, depth + 0.4),
                new THREE.MeshBasicMaterial({
                    color: C.highlight, transparent: true, opacity: 0, depthWrite: false,
                }),
            )
            hit.position.set(x0 + i * bayW + bayW / 2, hitH / 2, 0)
            hit.userData.hit = { row: spec.row, shelf: bay } satisfies BayHit
            hits.push(hit)
            group.add(hit)
        }
    }

    const c = center(spec.rect)
    group.position.set(c.x, 0, c.z)
    group.rotation.y = yaw(along, spec.rotation)
    return group
}

// ─── Murs et portes ──────────────────────────────────────────────────────────

/** Portes posées sur un segment de mur, en abscisses le long du segment. */
function doorsOnSegment(a: [number, number], b: [number, number], doors: DoorSpec[]) {
    const [ax, az] = a
    const [bx, bz] = b
    const len = Math.hypot(bx - ax, bz - az)
    const ux = (bx - ax) / len
    const uz = (bz - az) / len
    const onSegment = (px: number, pz: number) =>
        Math.abs((px - ax) * uz - (pz - az) * ux) < 0.05
    return doors
        .filter((door) => onSegment(...door.from) && onSegment(...door.to))
        .map((door) => {
            const t1 = (door.from[0] - ax) * ux + (door.from[1] - az) * uz
            const t2 = (door.to[0] - ax) * ux + (door.to[1] - az) * uz
            return [Math.min(t1, t2), Math.max(t1, t2)] as [number, number]
        })
        .filter(([t1, t2]) => t1 >= -0.05 && t2 <= len + 0.05)
        .sort((p, q) => p[0] - q[0])
}

/**
 * Murs extérieurs, un groupe par segment du contour : c'est l'unité masquée
 * par la vue en coupe (`cutaway.ts`), porte comprise. Retourne ces groupes.
 */
function walls(root: THREE.Group, floor: FloorLayout): THREE.Group[] {
    const wall = mat(C.wall, { roughness: 0.95 })
    const black = mat(C.door, { roughness: 0.4, metalness: 0.3 })
    const points = floor.outline
    const cutaway = outlineCutaway(points)
    const segments: THREE.Group[] = []

    points.forEach((a, i) => {
        const segment = new THREE.Group()
        segment.userData.cutaway = cutaway[i]
        segments.push(segment)
        root.add(segment)
        const b = points[(i + 1) % points.length]
        const len = Math.hypot(b[0] - a[0], b[1] - a[1])
        const angle = Math.atan2(b[1] - a[1], b[0] - a[0])
        const ux = (b[0] - a[0]) / len
        const uz = (b[1] - a[1]) / len
        const piece = (t1: number, t2: number, y: number, h: number, material: THREE.Material) => {
            const mid = (t1 + t2) / 2
            const mesh = box(t2 - t1, h, WALL_T, material, a[0] + ux * mid, y, a[1] + uz * mid)
            mesh.rotation.y = -angle
            segment.add(mesh)
        }

        let cursor = 0
        for (const [t1, t2] of doorsOnSegment(a, b, floor.doors)) {
            if (t1 > cursor) piece(cursor, t1, OUTER_WALL_H / 2, OUTER_WALL_H, wall)
            // Porte : montants et linteau noirs, seuil noir au sol, mur plein
            // au-dessus du linteau.
            piece(t1, t1 + 0.12, DOOR_H / 2, DOOR_H, black)
            piece(t2 - 0.12, t2, DOOR_H / 2, DOOR_H, black)
            piece(t1, t2, DOOR_H + 0.05, 0.1, black)
            piece(t1, t2, 0.02, 0.04, black)
            const above = OUTER_WALL_H - (DOOR_H + 0.1)
            piece(t1, t2, DOOR_H + 0.1 + above / 2, above, wall)
            cursor = t2
        }
        if (cursor < len) piece(cursor, len, OUTER_WALL_H / 2, OUTER_WALL_H, wall)
    })

    // Enseigne « SEE YOU SOON » au-dessus de l'entrée, côté salle.
    const shopDoor = floor.doors.find((door) => door.id === "porte-boutique")
    if (shopDoor) {
        const sign = new THREE.Mesh(
            new THREE.PlaneGeometry(4.2, 0.6),
            new THREE.MeshBasicMaterial({ map: signTexture(), transparent: true }),
        )
        sign.position.set((shopDoor.from[0] + shopDoor.to[0]) / 2, DOOR_H + 0.55, shopDoor.from[1] - WALL_T / 2 - 0.02)
        sign.rotation.y = Math.PI
        root.add(sign)
    }

    // Mascottes de la boutique, rattachées à leur segment de mur pour
    // disparaître avec lui en vue en coupe.
    const MASCOT_W = 2.1
    const mascot = (onWall: (meta: CutawayMeta) => boolean, x: number, y: number, z: number, rotationY: number) => {
        const mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(MASCOT_W, MASCOT_W / MASCOT_RATIO),
            new THREE.MeshBasicMaterial({ map: mascotTexture(), transparent: true }),
        )
        mesh.position.set(x, y, z)
        mesh.rotation.y = rotationY
        const wallSegment = segments.find((segment) => onWall(segment.userData.cutaway as CutawayMeta))
        ;(wallSegment ?? root).add(mesh)
    }

    // Mur du fond, entre les deux portants muraux : sur le pan libre entre la
    // porte de service et l'entrée.
    const serviceDoor = floor.doors.find((door) => door.id === "porte-service")
    if (shopDoor && serviceDoor) {
        const z = shopDoor.from[1]
        const x = (Math.max(serviceDoor.from[0], serviceDoor.to[0]) + Math.min(shopDoor.from[0], shopDoor.to[0])) / 2
        mascot((meta) => Math.abs(meta.mz - z) < 0.05 && Math.abs(meta.nx) < 0.05, x, 2.4, z - WALL_T / 2 - 0.02, Math.PI)
    }

    // Mur ouest (côté réserve B) : au-dessus du portant mural, au-dessus de
    // son étagère et des objets posés dessus.
    const westRail = floor.fixtures.find((spec) => spec.id === "portants-muraux")
    if (westRail) {
        const { rect } = westRail
        mascot(
            (meta) => Math.abs(meta.nz) < 0.05 && Math.abs(meta.mx - rect.x) < 0.3,
            rect.x + 0.02,
            3.6,
            rect.z + rect.d / 2,
            Math.PI / 2,
        )
    }

    for (const door of floor.doors) {
        const [title, ...rest] = door.label.split(" ")
        const label = makeLabel(title, rest.join(" ") || undefined, C.door)
        label.scale.set(2.8, 0.88, 1)
        label.position.set((door.from[0] + door.to[0]) / 2, DOOR_H + 1, (door.from[1] + door.to[1]) / 2)
        root.add(label)
    }

    return segments
}

// ─── Assemblage ──────────────────────────────────────────────────────────────

export interface WarehouseScene {
    root: THREE.Group
    /** Volumes cliquables, un par travée. */
    bayHits: THREE.Mesh[]
    /** Sols cliquables des zones, `userData.zone`. */
    zoneHits: THREE.Mesh[]
    /** Segments de murs extérieurs, masqués côté caméra (`applyCutaway`). */
    outerWalls: THREE.Group[]
}

export function buildWarehouse(floor: FloorLayout): WarehouseScene {
    const root = new THREE.Group()
    const bayHits: THREE.Mesh[] = []
    const zoneHits: THREE.Mesh[] = []
    const epv = new THREE.MeshStandardMaterial({ map: epvTexture(), roughness: 0.5 })

    // Dalle suivant le contour, puis sols de zone par-dessus.
    const shape = new THREE.Shape(floor.outline.map(([x, z]) => new THREE.Vector2(x, -z)))
    const slab = new THREE.Mesh(new THREE.ShapeGeometry(shape), mat(C.concrete, { roughness: 0.9 }))
    slab.rotation.x = -Math.PI / 2
    slab.receiveShadow = true
    root.add(slab)

    ;(Object.keys(floor.zones) as PlanZoneCode[]).forEach((zone) => {
        const rect = floor.zones[zone]
        const c = center(rect)
        const zoneFloor = new THREE.Mesh(
            new THREE.BoxGeometry(rect.w, 0.02, rect.d),
            zone === "D"
                ? mat(C.shopFloor, { roughness: 0.18, metalness: 0.05 })
                : zone === "A"
                  ? mat(C.darkConcrete, { roughness: 0.85 })
                  : mat(C.concrete, { roughness: 0.9 }),
        )
        zoneFloor.position.set(c.x, 0.01, c.z)
        zoneFloor.receiveShadow = true
        zoneFloor.userData.zone = zone
        zoneHits.push(zoneFloor)
        root.add(zoneFloor)

        const label = makeLabel(zone, PLAN_ZONES[zone].label, ZONE_LABEL_ACCENT[zone])
        label.scale.set(4.2, 1.3, 1)
        // B : dans l'allée entre les racks. D : au fond de la salle, pour ne
        // pas masquer la vue depuis l'entrée.
        label.position.set(c.x, 6.4, zone === "B" ? rect.z + rect.d * 0.65 : zone === "D" ? rect.z + 0.8 : c.z)
        root.add(label)
    })

    const outerWalls = walls(root, floor)
    for (const spec of floor.innerWalls) root.add(innerWall(spec, WALL_H))

    for (const spec of floor.racks) {
        root.add(rack(spec, bayHits))
        if (!spec.row) continue
        const along = spec.axis === "x"
        const label = makeLabel(spec.row, PLAN_ROW_LABELS[spec.row], "#dc2626")
        label.scale.set(2.2, 0.7, 1)
        label.position.set(
            along ? spec.rect.x - 0.9 : spec.rect.x + spec.rect.w / 2,
            // R2 / R3 sont dos à dos : étiquettes étagées pour ne pas se masquer.
            RACK_H + (spec.row === "R2" ? 1.5 : 0.7),
            along ? spec.rect.z + spec.rect.d / 2 : spec.rect.z + spec.rect.d + 0.9,
        )
        root.add(label)
    }

    for (const spec of floor.offices) root.add(office(spec.rect, spec.label, spec.rotation))
    for (const spec of floor.fixtures) root.add(fixture(spec))

    for (const p of floor.pillars) root.add(pillar(p.x, p.z, epv))

    // Crochets rouges au-dessus des portants muraux, comme sur les photos.
    for (const spec of floor.fixtures) {
        // Portant tourné en diagonale : il n'est plus contre un mur, pas de crochets.
        if (spec.kind !== "displayWall" || spec.axis !== "z" || spec.rotation) continue
        root.add(wallHooks(spec.rect.x + spec.rect.w / 2, spec.rect.z + 0.2, spec.rect.z + spec.rect.d - 0.2))
    }

    const plane = hangingPlane()
    plane.position.set(floor.plane.x, floor.plane.y, floor.plane.z)
    root.add(plane)

    return { root, bayHits, zoneHits, outerWalls }
}

// ─── Balles (partie dynamique) ───────────────────────────────────────────────

export interface BaleCounts {
    at: (row: PlanRow, shelf: PlanShelf, level: PlanLevel) => number
    zone: (zone: "A" | "D") => number
}


/** Hauteur du sol des balles « au sol » (toutes au sol aujourd'hui). */
const SPOT_FLOOR: Record<"A" | "D", number> = { A: 0, D: 0 }

/** Sacs posés dans chaque travée / niveau, et au sol de A et D. */
export function buildBales(floor: FloorLayout, counts: BaleCounts): THREE.Group {
    const group = new THREE.Group()

    for (const spec of floor.racks) {
        const row = spec.row
        if (!row) continue
        const along = spec.axis === "x"
        const rackCenter = center(spec.rect)
        const codes = rowBays(row)
        bayRects(spec, codes.length).forEach((bay, s) => {
            const shelf = codes[s]
            if (!isPlanShelf(row, shelf)) return
            // Centre de la travée, tourné avec le rack.
            const flat = center(bay)
            const c = rotatePoint(flat.x, flat.z, rackCenter.x, rackCenter.z, spec.rotation ?? 0)
            const length = along ? bay.w : bay.d
            for (const level of shelfLevels(row, shelf)) {
                const count = counts.at(row, shelf, level)
                if (count === 0) continue
                const y = LEVEL_Y[level] + (level === "H0" ? 0.07 : 0.04)
                const pile = balePile(
                    count,
                    Math.max(0.9, length - 0.5),
                    row.charCodeAt(1) * 100 + s * 10 + level.charCodeAt(1),
                )
                pile.position.set(c.x, y, c.z)
                pile.rotation.y = yaw(along, spec.rotation)
                group.add(pile)
                // Emplacement sur-rempli : la pile plafonne à 3 × 3, la pastille
                // dit le total.
                if (count > PILE_CAPACITY) {
                    const badge = makeLabel(`×${count}`)
                    badge.scale.set(1.1, 0.34, 1)
                    badge.position.set(c.x, y + 1.45, c.z)
                    group.add(badge)
                }
            }
        })
    }

    for (const zone of ["A", "D"] as const) {
        const count = counts.zone(zone)
        if (count === 0) continue
        const spot = floor.baleSpots[zone]
        const floorY = SPOT_FLOOR[zone]
        const base = palletMesh(spot.x, spot.z, 2.4, 1.6)
        base.position.y += floorY
        const pile = balePile(count, 2.2, zone.charCodeAt(0))
        pile.position.set(spot.x, floorY + 0.14, spot.z)
        const badge = makeLabel(`${count} balle${count > 1 ? "s" : ""}`)
        badge.scale.set(2, 0.62, 1)
        badge.position.set(spot.x, floorY + 2.3, spot.z)
        group.add(base, pile, badge)
    }

    return group
}

// ─── Repère « voir dans le plan » ────────────────────────────────────────────

/**
 * Point où poser le repère d'une balle : le plancher de sa hauteur au centre
 * de sa travée, ou le dessus de la palette au sol de A / D. `null` si la
 * rangée n'est pas dessinée.
 */
export function focusPosition(floor: FloorLayout, focus: PlanFocus): THREE.Vector3 | null {
    if (focus.kind === "zone") {
        const spot = floor.baleSpots[focus.zone]
        return new THREE.Vector3(spot.x, SPOT_FLOOR[focus.zone] + 0.14, spot.z)
    }
    const spec = floor.racks.find((rack) => rack.row === focus.row)
    if (!spec) return null
    const codes = rowBays(focus.row)
    const bay = bayRects(spec, codes.length)[codes.indexOf(focus.shelf)]
    if (!bay) return null
    const rackCenter = center(spec.rect)
    const flat = center(bay)
    const c = rotatePoint(flat.x, flat.z, rackCenter.x, rackCenter.z, spec.rotation ?? 0)
    return new THREE.Vector3(c.x, LEVEL_Y[focus.level] + 0.04, c.z)
}

export { HIGHLIGHT_COLORS, LIGHTING, SCENE_CENTER, VIEWPOINTS, type ViewpointId } from "./sceneConfig"
