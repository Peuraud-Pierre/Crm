import { expect, test } from "@rstest/core"
import { DEFAULT_FLOOR, type FloorLayout } from "./floorPlan"
import { insidePolygon, isFree, stepWalker, walkObstacles, walkStart } from "./walkCollision"

/**
 * Le personnage de la visite 3D reste dans le bâtiment et ne traverse pas le
 * mobilier.
 */

const R = 0.3
const obstacles = walkObstacles(DEFAULT_FLOOR)
const outline = DEFAULT_FLOOR.outline

test("le contour en L du bâtiment est respecté", () => {
    expect(insidePolygon(5, 5, outline)).toBe(true)
    // Coin bas-gauche : hors du L (la réserve s'arrête à z = 11,4).
    expect(insidePolygon(5, 25, outline)).toBe(false)
})

test("on ne traverse ni un rack, ni une colonne, ni un bureau", () => {
    const rack = DEFAULT_FLOOR.racks.find((r) => r.id === "R1")!.rect
    expect(isFree(rack.x + 2, rack.z + rack.d / 2, R, obstacles, outline)).toBe(false)
    const pillar = DEFAULT_FLOOR.pillars[0]
    expect(isFree(pillar.x + 0.2, pillar.z, R, obstacles, outline)).toBe(false)
    const office = DEFAULT_FLOOR.offices[0].rect
    expect(isFree(office.x + office.w / 2, office.z + office.d / 2, R, obstacles, outline)).toBe(false)
})

test("la passerelle se parcourt", () => {
    const walkway = DEFAULT_FLOOR.fixtures.find((f) => f.kind === "walkway")!.rect
    expect(isFree(walkway.x + walkway.w / 2, walkway.z + walkway.d / 2, R, obstacles, outline)).toBe(true)
})

test("un meuble tourné bloque selon son angle, pas selon son rectangle d'origine", () => {
    const floor: FloorLayout = {
        ...DEFAULT_FLOOR,
        racks: [],
        fixtures: [{ id: "t", kind: "table", rotation: 90, rect: { x: 20, z: 20, w: 4, d: 0.6 } }],
        pillars: [],
        offices: [],
        innerWalls: [],
    }
    const obs = walkObstacles(floor)
    // Tournée de 90°, la table s’étend en z autour de (22, 20.3) : (20.3, 20.3) est libre…
    expect(isFree(20.3, 20.3, 0.2, obs, floor.outline)).toBe(true)
    // …et z = 21.8 ne l'est plus.
    expect(isFree(22, 21.8, 0.2, obs, floor.outline)).toBe(false)
})

test("contre un obstacle, le personnage glisse le long au lieu de s'arrêter net", () => {
    // Colonne de l'allée de la réserve, dégagée autour.
    const pillar = DEFAULT_FLOOR.pillars.find((p) => p.id === "colonne-1")!
    const start = { x: pillar.x - 0.1, z: pillar.z + 1 }
    // En diagonale vers la colonne : l'axe z est bloqué, l'axe x passe.
    const next = stepWalker(start, 0.2, -0.5, R, obstacles, outline)
    expect(next.x).toBeCloseTo(start.x + 0.2)
    expect(next.z).toBe(start.z)
})

test("le départ se fait à l'intérieur, sur un point libre, près de l'entrée", () => {
    const start = walkStart(DEFAULT_FLOOR, R)
    expect(isFree(start.x, start.z, R, obstacles, outline)).toBe(true)
    expect(start.z).toBeGreaterThan(28)
})
