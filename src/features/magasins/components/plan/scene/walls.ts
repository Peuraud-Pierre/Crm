// Volumes 3D tirés d'un tracé : murs et formes libres.

import * as THREE from "three"
import type { Mur, Point } from "@/features/magasins/types/magasin.types"
import type { Bounds } from "@/features/magasins/utils/planGeometry"
import { filledOutline, wallSegments } from "@/features/magasins/utils/wall"

/**
 * Volume d'une forme libre : le tracé (relatif au rectangle w × d) extrudé
 * sur `height`. Centré sur l'origine, au sol ; ExtrudeGeometry pousse selon
 * +Z, on la couche donc (−90° sur X) pour qu'elle monte selon +Y.
 */
export function extrudedShape(forme: readonly Point[], w: number, d: number, height: number, material: THREE.Material) {
    // Repère de la forme couchée : y de la forme → −z de la scène.
    const shape = new THREE.Shape(forme.map(([u, v]) => new THREE.Vector2((u - 0.5) * w, -(v - 0.5) * d)))
    const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false }), material)
    mesh.rotation.x = -Math.PI / 2
    const group = new THREE.Group()
    group.add(mesh)
    return group
}

/**
 * Mur en 3D : un volume par segment, à sa hauteur et son épaisseur, dans le
 * repère centré du magasin. Regroupés sous une clé pour être sélectionnés
 * d'un bloc.
 */
export function buildWall(mur: Mur, bounds: Bounds, material: THREE.Material): THREE.Group {
    const group = new THREE.Group()
    const outline = filledOutline(mur.points)
    if (outline) {
        // Mur à quatre points : son pourtour, extrudé plein à sa hauteur.
        const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x - bounds.width / 2, -(y - bounds.depth / 2))))
        const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: mur.hauteur, bevelEnabled: false }), material)
        mesh.rotation.x = -Math.PI / 2
        group.add(mesh)
        return group
    }
    for (const s of wallSegments(mur.points)) {
        // Prolongé d'une demi-épaisseur à chaque bout : les angles se ferment.
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(s.length + mur.epaisseur, mur.hauteur, mur.epaisseur), material)
        mesh.position.set(s.cx - bounds.width / 2, mur.hauteur / 2, s.cy - bounds.depth / 2)
        // Angle du plan (y vers le bas) → rotation autour de Y en sens inverse.
        mesh.rotation.y = -s.angle
        group.add(mesh)
    }
    return group
}

