import { expect, test } from "@rstest/core"
import * as THREE from "three"
import { buildPortant, PORTANT_HEIGHT } from "./portant"

const spec = { color: new THREE.Color(0.6, 0.2, 0.2), metal: new THREE.Color(0.5, 0.5, 0.5), opacity: 1 }

function bounds(group: THREE.Group) {
    return new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3())
}

test("un portant de 1,5 m suit sa longueur, à hauteur de barre", () => {
    const size = bounds(buildPortant({ ...spec, w: 1.5, d: 0.6 }))
    expect(size.x).toBeGreaterThan(1.4)
    expect(size.x).toBeLessThanOrEqual(1.55)
    expect(size.z).toBeLessThanOrEqual(0.65)
    expect(size.y).toBeCloseTo(PORTANT_HEIGHT, 1)
})

test("posé en travers, il se dessine le long de z", () => {
    const size = bounds(buildPortant({ ...spec, w: 0.6, d: 2 }))
    expect(size.z).toBeGreaterThan(1.9)
    expect(size.x).toBeLessThanOrEqual(0.65)
})

test("le nombre de vêtements suit la longueur, avec un cintre chacun", () => {
    const meshes = (w: number) => buildPortant({ ...spec, w, d: 0.6 }).children.length
    // 2 montants + 2 pieds + 1 barre, puis un vêtement et un cintre par pièce.
    const fixed = 5
    const short = (meshes(0.6) - fixed) / 2
    const long = (meshes(3) - fixed) / 2
    expect(short).toBeGreaterThanOrEqual(1)
    expect(long).toBeGreaterThan(short * 4)
})
