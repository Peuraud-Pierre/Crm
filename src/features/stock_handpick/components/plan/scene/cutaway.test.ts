import { expect, test } from "@rstest/core"
import { facesCamera, outlineCutaway } from "./cutaway"

/**
 * Vue en coupe : un mur extérieur est masqué quand la caméra est de son côté
 * (dehors, face à lui) ; les murs du fond restent affichés.
 */

const SQUARE: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10]]
// Segment 0 : (0,0)→(10,0), mur nord (z = 0) ; segment 2 : mur sud (z = 10).

test("caméra au sud : seul le mur sud est masqué", () => {
    const walls = outlineCutaway(SQUARE)

    expect(walls.map((w) => facesCamera(w, 5, 30))).toEqual([false, false, true, false])
})

test("le sens de parcours du contour ne change rien", () => {
    const reversed = outlineCutaway([...SQUARE].reverse())

    // Inversé : (0,10)→(10,10) est le segment 0, le mur sud.
    expect(facesCamera(reversed[0], 5, 30)).toBe(true)
    expect(facesCamera(reversed[0], 5, -30)).toBe(false)
})

test("contour en L : le mur du coin rentrant est bien orienté", () => {
    // L : il manque le carré en haut à droite (10..20 × 0..10).
    const L: [number, number][] = [[0, 0], [10, 0], [10, 10], [20, 10], [20, 20], [0, 20]]
    const walls = outlineCutaway(L)

    // Segment 1 : (10,0)→(10,10), mur du coin rentrant, qui regarde vers x+.
    expect(facesCamera(walls[1], 15, 5)).toBe(true)
    expect(facesCamera(walls[1], 5, 5)).toBe(false)
})

test("caméra à l'intérieur (promenade) : aucun mur masqué", () => {
    expect(outlineCutaway(SQUARE).some((w) => facesCamera(w, 5, 5))).toBe(false)
})
