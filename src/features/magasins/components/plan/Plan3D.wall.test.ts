import { expect, test } from "@rstest/core"
import * as THREE from "three"
import type { Mur } from "@/features/magasins/types/magasin.types"
import { buildWall } from "./scene/walls"

test("un mur en L donne deux volumes, à sa hauteur, le long de ses segments", () => {
    const mur = { id: "w", points: [[0, 5], [8, 5], [8, 9]], epaisseur: 0.2, hauteur: 2.5 } as Mur
    const group = buildWall(mur, { width: 10, depth: 10 }, new THREE.MeshBasicMaterial())
    group.updateMatrixWorld(true)
    expect(group.children).toHaveLength(2)
    const box = (i: number) => new THREE.Box3().setFromObject(group.children[i])
    // Segment horizontal : de x = 0 à 8 sur le plan → -5 à 3 dans la scène, en z = 0.
    expect(box(0).min.x).toBeCloseTo(-5 - 0.1)
    expect(box(0).max.x).toBeCloseTo(3 + 0.1)
    expect(box(0).max.y).toBeCloseTo(2.5)
    expect(box(0).getCenter(new THREE.Vector3()).z).toBeCloseTo(0)
    // Segment vertical : en x = 3, de z = 0 à 4 (vers le bas du plan).
    expect(box(1).getCenter(new THREE.Vector3()).x).toBeCloseTo(3)
    expect(box(1).max.z).toBeCloseTo(4 + 0.1)
    expect(box(1).min.z).toBeCloseTo(0 - 0.1)
})

test("un mur à quatre points est un bloc plein, extrudé à sa hauteur", () => {
    const mur = { id: "w", points: [[1, 1], [3, 1], [3, 1.5], [1, 1.5]], epaisseur: 0.2, hauteur: 2.5 } as Mur
    const group = buildWall(mur, { width: 10, depth: 10 }, new THREE.MeshBasicMaterial())
    group.updateMatrixWorld(true)
    expect(group.children).toHaveLength(1)
    const box = new THREE.Box3().setFromObject(group)
    expect(box.min.x).toBeCloseTo(-4)
    expect(box.max.x).toBeCloseTo(-2)
    expect(box.min.z).toBeCloseTo(-4)
    expect(box.max.z).toBeCloseTo(-3.5)
    expect(box.max.y).toBeCloseTo(2.5)
})
