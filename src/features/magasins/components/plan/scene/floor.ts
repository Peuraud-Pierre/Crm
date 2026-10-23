// Sol de l'étage en 3D, percé là où un escalier descend vers l'étage du dessous.

import * as THREE from "three"
import type { PlanItem, Point } from "@/features/magasins/types/magasin.types"
import { isStairs } from "@/features/magasins/utils/group"
import { rectOf, type Bounds } from "@/features/magasins/utils/planGeometry"
import { toAbsolute } from "@/features/magasins/utils/shape"

/** Emprise au sol (en mètres, repère du plan) de chaque escalier qui descend. */
export function descentHoles(items: readonly PlanItem[]): Point[][] {
    return items.flatMap((item) => {
        const rect = item.descend && isStairs(item) ? rectOf(item.geometry) : null
        if (!rect) return []
        const cx = rect.x + rect.w / 2
        const cy = rect.y + rect.h / 2
        const a = (item.geometry.rotation * Math.PI) / 180
        const turn = ([x, y]: Point): Point => [
            cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a),
            cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a),
        ]
        if (item.forme) return [toAbsolute(item.forme, rect).map(turn)]
        if (item.kind === "escalier_colimacon") {
            const r = Math.min(rect.w, rect.h) / 2
            return [Array.from({ length: 32 }, (_, i): Point => [cx + r * Math.cos((i * Math.PI) / 16), cy + r * Math.sin((i * Math.PI) / 16)])]
        }
        const corners: Point[] = [
            [rect.x, rect.y],
            [rect.x + rect.w, rect.y],
            [rect.x + rect.w, rect.y + rect.h],
            [rect.x, rect.y + rect.h],
        ]
        return [corners.map(turn)]
    })
}

/**
 * Réglage d'un matériau masqué par les trémies (sol, grille) : il ne se
 * dessine pas là où une trémie a marqué l'écran.
 */
export function maskedByHoles<T extends THREE.Material>(material: T): T {
    material.stencilWrite = true
    material.stencilRef = 1
    material.stencilFunc = THREE.NotEqualStencilFunc
    return material
}

/**
 * Sol à la forme de l'étage, percé des trémies. Le trou n'est pas découpé
 * dans la forme : des trous qui se touchent ou se chevauchent (volées
 * fusionnées) font échouer la triangulation, qui en perd. Chaque trémie est
 * plutôt une surface invisible, dessinée avant le sol, qui marque l'écran
 * (stencil) : le sol ne se dessine pas là. Autant de volées qu'on veut,
 * collées ou non, font un seul trou. Tracé dans le plan XY puis couché :
 * y du plan → −y de la forme, pour que le haut du plan 2D reste au fond.
 */
export function buildFloor(outline: readonly Point[], holes: readonly Point[][], bounds: Bounds, material: THREE.Material) {
    const toShape = ([x, y]: Point) => new THREE.Vector2(x - bounds.width / 2, -(y - bounds.depth / 2))
    const group = new THREE.Group()
    const floor = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(outline.map(toShape))), maskedByHoles(material))
    floor.rotation.x = -Math.PI / 2
    group.add(floor)
    const mask = new THREE.MeshBasicMaterial({
        colorWrite: false,
        depthWrite: false,
        side: THREE.DoubleSide,
        stencilWrite: true,
        stencilRef: 1,
        stencilFunc: THREE.AlwaysStencilFunc,
        stencilZPass: THREE.ReplaceStencilOp,
    })
    for (const hole of holes) {
        const mesh = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(hole.map(toShape))), mask)
        mesh.rotation.x = -Math.PI / 2
        // Avant le sol et la grille, pour que le marquage soit en place.
        mesh.renderOrder = -1
        group.add(mesh)
    }
    return group
}

/** Profondeur de la descente simulée sous une trémie : quelques marches, pas un étage. */
export const DESCENT_DEPTH = 0.8

function inside([x, y]: Point, polygon: readonly Point[]): boolean {
    let hit = false
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const [xi, yi] = polygon[i]
        const [xj, yj] = polygon[j]
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit
    }
    return hit
}

/** Paroi verticale sous le bord a → b, sur la profondeur de la descente. */
function pitWall(a: Point, b: Point, bounds: Bounds, material: THREE.Material) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(Math.hypot(b[0] - a[0], b[1] - a[1]), DESCENT_DEPTH), material)
    wall.position.set((a[0] + b[0]) / 2 - bounds.width / 2, -DESCENT_DEPTH / 2, (a[1] + b[1]) / 2 - bounds.depth / 2)
    wall.rotation.y = -Math.atan2(b[1] - a[1], b[0] - a[0])
    return wall
}

/**
 * Parois des trémies : un bord vertical sombre sous chaque côté du trou, sur
 * la profondeur de la descente simulée. Le côté qu'une trémie partage avec
 * une autre (volées fusionnées) reste ouvert : la descente y continue.
 */
export function buildPitWalls(holes: readonly Point[][], bounds: Bounds, material: THREE.Material): THREE.Group {
    const group = new THREE.Group()
    holes.forEach((hole, h) => {
        hole.forEach((a, i) => {
            const b = hole[(i + 1) % hole.length]
            const length = Math.hypot(b[0] - a[0], b[1] - a[1])
            if (length < 1e-3) return
            const nx = -(b[1] - a[1]) / length
            const ny = (b[0] - a[0]) / length
            // Bord découpé en tronçons de 10 cm : un tronçon qui donne, d'un côté
            // ou de l'autre, dans une autre trémie reste ouvert.
            const pieces = Math.max(1, Math.ceil(length / 0.1))
            const at = (t: number): Point => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
            const open = (k: number) => {
                const [mx, my] = at((k + 0.5) / pieces)
                return [1, -1].some((side) =>
                    holes.some((other, o) => o !== h && inside([mx + side * nx * 0.05, my + side * ny * 0.05], other)),
                )
            }
            let from = -1
            for (let k = 0; k <= pieces; k++) {
                const closed = k < pieces && !open(k)
                if (closed && from < 0) from = k
                if (!closed && from >= 0) {
                    group.add(pitWall(at(from / pieces), at(k / pieces), bounds, material))
                    from = -1
                }
            }
        })
    })
    return group
}
