import * as THREE from "three"
import type { EquipementSpec } from "./equipements"

/** Hauteur d'un mannequin de vitrine, tête comprise, socle au sol. */
export const MANNEQUIN_HEIGHT = 1.8

/**
 * Mannequin de vitrine : socle rond, tige, buste (torse et bassin), cou et
 * tête, dans la couleur de son rôle. Épaules selon la plus grande dimension
 * du rectangle ; il regarde vers +z (le bas du plan), ou +x s'il est posé en
 * long — comme le nez du plan 2D. Centré sur l'origine, au sol.
 */
export function buildMannequin({ w, d, color, neutral, opacity }: EquipementSpec): THREE.Group {
    const group = new THREE.Group()
    const body = new THREE.MeshStandardMaterial({ color, transparent: opacity < 1, opacity, roughness: 0.5 })
    const metal = new THREE.MeshStandardMaterial({
        color: neutral.clone().multiplyScalar(0.5),
        transparent: opacity < 1,
        opacity,
        metalness: 0.6,
        roughness: 0.4,
    })
    const shoulders = Math.max(w, d)
    const add = (geometry: THREE.BufferGeometry, material: THREE.Material, y: number) => {
        const mesh = new THREE.Mesh(geometry, material)
        mesh.position.y = y
        group.add(mesh)
        return mesh
    }
    add(new THREE.CylinderGeometry(Math.min(w, d) / 2, Math.min(w, d) / 2, 0.03, 24), metal, 0.015)
    add(new THREE.CylinderGeometry(0.015, 0.015, 0.75, 8), metal, 0.03 + 0.375)
    // Bassin et torse : sphères aplaties, le torse plus large aux épaules.
    const hips = add(new THREE.SphereGeometry(0.5, 20, 14), body, 0.95)
    hips.scale.set(shoulders * 0.62, 0.3, 0.2)
    const torso = add(new THREE.SphereGeometry(0.5, 20, 14), body, 1.3)
    torso.scale.set(shoulders * 0.85, 0.55, 0.24)
    add(new THREE.CylinderGeometry(0.045, 0.05, 0.12, 12), body, 1.6)
    const head = add(new THREE.SphereGeometry(0.11, 20, 14), body, MANNEQUIN_HEIGHT - 0.11)
    head.scale.set(0.85, 1, 1)
    // Nez, pour lire où il regarde.
    const nose = add(new THREE.ConeGeometry(0.02, 0.05, 8), body, MANNEQUIN_HEIGHT - 0.12)
    nose.rotation.x = Math.PI / 2
    nose.position.z = 0.1
    // Posé en long : on le tourne d'un quart pour garder les épaules dans la longueur.
    if (d > w) group.rotation.y = Math.PI / 2
    const holder = new THREE.Group()
    holder.add(group)
    return holder
}
