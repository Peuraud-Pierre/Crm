import { expect, test } from "@rstest/core"
import * as THREE from "three"
import { buildMannequin, MANNEQUIN_HEIGHT } from "./mannequin"

const spec = { color: new THREE.Color(0.3, 0.3, 0.4), neutral: new THREE.Color(0.5, 0.5, 0.5), opacity: 1 }
const box = (o: THREE.Object3D) => {
    o.updateMatrixWorld(true)
    return new THREE.Box3().setFromObject(o)
}

test("mannequin : au sol, à hauteur d'homme, épaules dans la longueur", () => {
    const b = box(buildMannequin({ ...spec, w: 0.5, d: 0.35 }))
    expect(b.min.y).toBeCloseTo(0, 2)
    expect(b.max.y).toBeCloseTo(MANNEQUIN_HEIGHT, 1)
    const size = b.getSize(new THREE.Vector3())
    expect(size.x).toBeGreaterThan(size.z)
})

test("posé en long, il tourne d'un quart : les épaules suivent la longueur", () => {
    const size = box(buildMannequin({ ...spec, w: 0.35, d: 0.5 })).getSize(new THREE.Vector3())
    expect(size.z).toBeGreaterThan(size.x)
})
