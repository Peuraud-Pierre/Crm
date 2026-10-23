/* eslint-disable nokk-project/no-restricted-syntax -- couleurs de rendu 3D, non tokenisables (design system §12.4) */
import * as THREE from "three"
import { makeLabel } from "./sceneParts"

const GLOW = "#facc15"
const BEAM_H = 7

/**
 * Repère « la balle est ici » : un sac lumineux qui pulse, un faisceau
 * vertical visible de loin et une étiquette. Posé au niveau exact de la balle
 * (étagère ou sol). Le pouls tourne dans `onBeforeRender` : aucune boucle à
 * ajouter côté composant.
 */
export function buildFocusMarker(position: THREE.Vector3, label: string): THREE.Group {
    const group = new THREE.Group()
    group.position.copy(position)

    const glow = new THREE.MeshStandardMaterial({
        color: GLOW,
        emissive: GLOW,
        emissiveIntensity: 1.2,
        roughness: 0.4,
    })
    const bag = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 14), glow)
    bag.scale.set(1.05, 0.5, 0.7)
    bag.position.y = 0.3
    bag.onBeforeRender = () => {
        const t = performance.now() / 1000
        const pulse = (Math.sin(t * 4) + 1) / 2
        glow.emissiveIntensity = 0.8 + pulse * 1.4
        const s = 1 + pulse * 0.12
        bag.scale.set(1.05 * s, 0.5 * s, 0.7 * s)
    }

    const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.35, BEAM_H, 16, 1, true),
        new THREE.MeshBasicMaterial({
            color: GLOW,
            transparent: true,
            opacity: 0.28,
            depthWrite: false,
            side: THREE.DoubleSide,
        }),
    )
    beam.position.y = BEAM_H / 2 + 0.3

    const light = new THREE.PointLight(GLOW, 6, 5)
    light.position.y = 0.8

    const tag = makeLabel(label, "est ici", GLOW)
    tag.scale.set(2.4, 0.75, 1)
    tag.position.y = BEAM_H + 0.9

    group.add(bag, beam, light, tag)
    return group
}
