import { expect, test } from "@rstest/core"
import * as THREE from "three"
import { equipement } from "../../../__fixtures__/plan"
import { buildPlanItems } from "@/features/magasins/utils/planTree"
import { buildFloor, buildPitWalls, DESCENT_DEPTH, descentHoles } from "./floor"

const stairs = (id: string, descend: boolean, rotation = 0) => ({
    ...equipement(id, id, "escalier"),
    pos_x: 2,
    pos_y: 2,
    width: 3,
    height: 1,
    rotation,
    descend,
})

test("seul un escalier qui descend perce le sol, à son emprise tournée", () => {
    const items = buildPlanItems([], [], [stairs("up", false), stairs("down", true, 90)])
    const holes = descentHoles(items)
    expect(holes).toHaveLength(1)
    // Tourné de 90° autour de son centre (3,5 ; 2,5) : 1 m de large, 3 m de long.
    const xs = holes[0].map(([x]) => x)
    const ys = holes[0].map(([, y]) => y)
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(1)
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(3)
})

test("deux trémies qui se touchent font un seul trou : aucune n'est perdue", () => {
    const outline: [number, number][] = [[0, 0], [10, 0], [10, 8], [0, 8]]
    const a: [number, number][] = [[1, 1], [4, 1], [4, 2], [1, 2]]
    const b: [number, number][] = [[4, 1], [5, 1], [5, 4], [4, 4]]
    const floor = buildFloor(outline, [a, b], { width: 10, depth: 8 }, new THREE.MeshBasicMaterial())
    const [sol, ...masks] = floor.children as THREE.Mesh[]
    // Le sol garde tout le contour ; il ne se dessine pas là où les trémies marquent l'écran.
    const size = new THREE.Box3().setFromObject(sol).getSize(new THREE.Vector3())
    expect(size.x).toBeCloseTo(10)
    expect(size.z).toBeCloseTo(8)
    expect((sol.material as THREE.Material).stencilFunc).toBe(THREE.NotEqualStencilFunc)
    // Une trémie par volée, chacune entière, marquée avant le sol.
    expect(masks).toHaveLength(2)
    expect(masks.every((m) => m.renderOrder < sol.renderOrder)).toBe(true)
    const zone = (m: THREE.Mesh) => new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3())
    expect(zone(masks[1]).x).toBeCloseTo(1)
    expect(zone(masks[1]).z).toBeCloseTo(3)
})

test("trémie : une paroi sombre par bord, sauf là où deux volées se touchent", () => {
    const bounds = { width: 10, depth: 8 }
    const a: [number, number][] = [[1, 1], [4, 1], [4, 2], [1, 2]]
    const b: [number, number][] = [[4, 1], [5, 1], [5, 4], [4, 4]]
    expect(buildPitWalls([a], bounds, new THREE.MeshBasicMaterial()).children).toHaveLength(4)
    // Le bord commun x = 4 (de y 1 à 2) reste ouvert ; sous y = 2, b se referme.
    const walls = buildPitWalls([a, b], bounds, new THREE.MeshBasicMaterial())
    expect(walls.children).toHaveLength(7)
    walls.updateMatrixWorld(true)
    const atJunction = walls.children
        .map((w) => new THREE.Box3().setFromObject(w))
        .filter((w) => Math.abs(w.min.x - -1) < 0.01 && Math.abs(w.max.x - -1) < 0.01)
    expect(atJunction).toHaveLength(1)
    expect(atJunction[0].min.z).toBeCloseTo(-2)
    expect(atJunction[0].max.z).toBeCloseTo(0)
    const box = new THREE.Box3().setFromObject(walls)
    expect(box.min.y).toBeCloseTo(-DESCENT_DEPTH)
    expect(box.max.y).toBeCloseTo(0)
})
