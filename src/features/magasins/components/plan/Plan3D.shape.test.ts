import { expect, test } from "@rstest/core"
import * as THREE from "three"
import { extrudedShape } from "./scene/walls"

test("une forme libre est extrudée vers le haut, le haut du plan au fond de la scène", () => {
    // Triangle relatif : pointe en haut-gauche du plan (u = 0, v = 0).
    const group = extrudedShape([[0, 0], [1, 1], [0, 1]], 4, 2, 0.9, new THREE.MeshBasicMaterial())
    group.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(group)
    expect(box.min.y).toBeCloseTo(0)
    expect(box.max.y).toBeCloseTo(0.9)
    expect(box.min.x).toBeCloseTo(-2)
    expect(box.max.x).toBeCloseTo(2)
    expect(box.min.z).toBeCloseTo(-1)
    expect(box.max.z).toBeCloseTo(1)

    // Le sommet (u = 0, v = 0) doit être au fond (z = -1), côté gauche (x = -2).
    const mesh = group.children[0] as THREE.Mesh
    const position = mesh.geometry.getAttribute("position")
    const corners = Array.from({ length: position.count }, (_, i) =>
        new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld),
    )
    expect(corners.some((c) => Math.abs(c.x + 2) < 1e-6 && Math.abs(c.z + 1) < 1e-6)).toBe(true)
    // Et rien au fond à droite : le triangle n'y passe pas.
    expect(corners.some((c) => Math.abs(c.x - 2) < 1e-6 && Math.abs(c.z + 1) < 1e-6)).toBe(false)
})
