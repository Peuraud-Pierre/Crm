import { expect, test } from "@rstest/core"
import * as THREE from "three"
import { buildCaisse, buildColimacon, buildEscalier, buildPorte, COUNTER_HEIGHT, DOOR_HEIGHT } from "./equipements"

const spec = { color: new THREE.Color(0.8, 0.5, 0.1), neutral: new THREE.Color(0.5, 0.5, 0.5), opacity: 1 }
const size = (group: THREE.Group) => new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3())

test("comptoir de caisse : emprise du plan, écran au-dessus du plateau", () => {
    const s = size(buildCaisse({ ...spec, w: 1.6, d: 0.7 }))
    expect(s.x).toBeCloseTo(1.66, 1)
    expect(s.z).toBeCloseTo(0.76, 1)
    expect(s.y).toBeGreaterThan(COUNTER_HEIGHT + 0.3)
})

test("porte : hauteur de passage, posée en travers si le rectangle l'est", () => {
    const along = size(buildPorte({ ...spec, w: 1.4, d: 0.2 }))
    expect(along.x).toBeCloseTo(1.4, 1)
    expect(along.y).toBeGreaterThan(DOOR_HEIGHT)
    const across = size(buildPorte({ ...spec, w: 0.2, d: 2 }))
    expect(across.z).toBeCloseTo(2, 1)
})

test("deux vantaux au-delà de 1,2 m de passage", () => {
    const leaves = (w: number) =>
        buildPorte({ ...spec, w, d: 0.2 }).children.filter(
            (c) => ((c as THREE.Mesh).material as THREE.MeshStandardMaterial).opacity < 1,
        ).length
    expect(leaves(1)).toBe(1)
    expect(leaves(2)).toBe(2)
})

test("escalier : les marches montent vers le bout du rectangle, comme la flèche du plan", () => {
    for (const [w, d, axis] of [[1, 3, "z"], [3, 1, "x"]] as const) {
        const group = buildEscalier({ ...spec, w, d }, 2.8)
        const marches = group.children.slice(0, -1) as THREE.Mesh[]
        const hauteur = (m: THREE.Mesh) => new THREE.Box3().setFromObject(m).max.y
        const position = (m: THREE.Mesh) => m.position[axis]
        // Une marche par 18 cm de hauteur, de plus en plus haute vers +axe.
        expect(marches).toHaveLength(16)
        expect(position(marches[15])).toBeGreaterThan(position(marches[0]))
        expect(hauteur(marches[15])).toBeCloseTo(2.8)
        expect(hauteur(marches[0])).toBeCloseTo(2.8 / 16)
        // Emprise au sol : celle du rectangle.
        const size = new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3())
        expect(axis === "x" ? size.x : size.z).toBeCloseTo(3, 0)
    }
})

test("colimaçon : départ en haut du cercle, montée dans le sens horaire vu de dessus", () => {
    const group = buildColimacon({ ...spec, w: 1.6, d: 1.6 }, 2.8)
    group.updateMatrixWorld(true)
    const marches = group.children.slice(1) // le premier enfant est le poteau
    expect(marches).toHaveLength(16)
    // Centre de chaque marche, vu de dessus (x à droite, z vers le bas du plan).
    const centre = (i: number) => new THREE.Box3().setFromObject(marches[i]).getCenter(new THREE.Vector3())
    const hauteur = (i: number) => new THREE.Box3().setFromObject(marches[i]).max.y
    // Départ en haut-droite (juste après midi), puis droite, bas, gauche.
    expect(centre(0).z).toBeLessThan(0)
    expect(centre(0).x).toBeGreaterThan(0)
    expect(centre(4).x).toBeGreaterThan(0.3)
    expect(centre(8).z).toBeGreaterThan(0.3)
    expect(centre(12).x).toBeLessThan(-0.3)
    // Chaque marche plus haute que la précédente, la dernière à l'étage.
    for (let i = 1; i < 16; i++) expect(hauteur(i)).toBeGreaterThan(hauteur(i - 1))
    expect(hauteur(15)).toBeCloseTo(2.8, 1)
})

test("volée d'un escalier fusionné : elle part du niveau où la précédente arrive", () => {
    const group = buildEscalier({ ...spec, w: 3, d: 1 }, 1.2, 1.6)
    const marches = group.children.slice(0, -1) as THREE.Mesh[]
    const haut = (m: THREE.Mesh) => new THREE.Box3().setFromObject(m).max.y
    expect(haut(marches[0])).toBeGreaterThan(1.6)
    expect(haut(marches[marches.length - 1])).toBeCloseTo(2.8)
})

test("escalier qui descend : les marches s'enfoncent sous le sol dans le sens de la flèche", () => {
    const group = buildEscalier({ ...spec, w: 3, d: 1 }, 2.8, 0, true)
    const marches = group.children as THREE.Mesh[]
    const box = (m: THREE.Mesh) => new THREE.Box3().setFromObject(m)
    // Toutes sous le sol, de plus en plus basses vers +x, posées sur l'étage du dessous.
    expect(Math.max(...marches.map((m) => box(m).max.y))).toBeLessThan(0)
    expect(box(marches[0]).max.y).toBeGreaterThan(box(marches[marches.length - 1]).max.y)
    expect(marches[marches.length - 1].position.x).toBeGreaterThan(marches[0].position.x)
    expect(box(marches[0]).min.y).toBeCloseTo(-2.8)
})
