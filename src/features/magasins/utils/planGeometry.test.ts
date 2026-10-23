import { expect, test } from "@rstest/core"
import { buildPlanItems } from "./planTree"
import { zone } from "../__fixtures__/plan"
import {
    clampRect,
    containingZone,
    drawnKind,
    geometryOf,
    initialRect,
    moveFond,
    moveRect,
    resizeByHandle,
    resizeFond,
    sameGeometry,
} from "./planGeometry"

const bounds = { width: 10, depth: 8 }

test("moveRect déplace au pas de 10 cm et reste dans le magasin", () => {
    expect(moveRect({ x: 1, y: 1, w: 2, h: 1 }, 0.34, 0.06, bounds)).toEqual({ x: 1.3, y: 1.1, w: 2, h: 1 })
    expect(moveRect({ x: 1, y: 1, w: 2, h: 1 }, 50, -50, bounds)).toEqual({ x: 8, y: 0, w: 2, h: 1 })
})

test("clampRect ramène un rectangle trop grand dans l'emprise", () => {
    expect(clampRect({ x: -1, y: 5, w: 20, h: 4 }, bounds)).toEqual({ x: 0, y: 4, w: 10, h: 4 })
})

test("initialRect pose au centre du parent, ou du magasin", () => {
    expect(initialRect("emplacement", bounds, { x: 2, y: 2, w: 4, h: 2 })).toEqual({ x: 3.5, y: 2.7, w: 1, h: 0.6 })
    expect(initialRect("zone", bounds)).toEqual({ x: 2.5, y: 2, w: 5, h: 4 })
})

test("geometryOf / sameGeometry : retrait du plan et comparaison au centimètre", () => {
    expect(geometryOf(null)).toEqual({ pos_x: null, pos_y: null, width: null, height: null, rotation: 0 })
    const g = geometryOf({ x: 1.001, y: 2, w: 3, h: 4 }, 450)
    expect(g).toEqual({ pos_x: 1, pos_y: 2, width: 3, height: 4, rotation: 90 })
    expect(sameGeometry(g, { ...g, pos_x: 1.004 })).toBe(true)
    expect(sameGeometry(g, { ...g, rotation: 0 })).toBe(false)
    expect(sameGeometry(geometryOf(null), g)).toBe(false)
})

test("containingZone propose le plus petit conteneur placé sous le centre du tracé", () => {
    const items = buildPlanItems(
        [
            zone("a", "A", "zone", null, { pos_x: 0, pos_y: 0, width: 10, height: 8 }),
            zone("r", "R1", "rayon", "a", { pos_x: 1, pos_y: 1, width: 4, height: 2 }),
            zone("b", "B", "zone", null),
        ],
        [],
    )
    expect(containingZone({ x: 2, y: 1.5, w: 1, h: 0.5 }, items)?.code).toBe("R1")
    expect(containingZone({ x: 7, y: 6, w: 1, h: 1 }, items)?.code).toBe("A")
    expect(containingZone({ x: 20, y: 20, w: 1, h: 1 }, items)).toBeNull()
})

test("drawnKind descend d'un niveau sous le conteneur", () => {
    const [a, r] = buildPlanItems([zone("a", "A", "zone"), zone("r", "R1", "rayon", "a")], [])
    expect(drawnKind(null)).toBe("zone")
    expect(drawnKind(a)).toBe("rayon")
    expect(drawnKind(r)).toBe("etagere")
})

test("moveFond déplace au centimètre, sans borner au magasin", () => {
    expect(moveFond({ x: 1, y: 1, w: 20, h: 10 }, -3.456, 0.123)).toEqual({ x: -2.46, y: 1.12, w: 20, h: 10 })
})

test("resizeFond garde les proportions et une largeur minimale", () => {
    expect(resizeFond({ x: 0, y: 0, w: 20, h: 10 }, 4)).toEqual({ x: 0, y: 0, w: 24, h: 12 })
    expect(resizeFond({ x: 0, y: 0, w: 20, h: 10 }, -50)).toEqual({ x: 0, y: 0, w: 1, h: 0.5 })
})

const big = { width: 50, depth: 50 }

test("resizeByHandle : chaque poignée tire son côté, le côté opposé ne bouge pas", () => {
    const r = { x: 10, y: 10, w: 4, h: 2 }
    expect(resizeByHandle(r, 0, "e", 1, 5, big)).toEqual({ x: 10, y: 10, w: 5, h: 2 })
    expect(resizeByHandle(r, 0, "w", -1, 5, big)).toEqual({ x: 9, y: 10, w: 5, h: 2 })
    expect(resizeByHandle(r, 0, "n", 5, -0.5, big)).toEqual({ x: 10, y: 9.5, w: 4, h: 2.5 })
    expect(resizeByHandle(r, 0, "nw", -1, -1, big)).toEqual({ x: 9, y: 9, w: 5, h: 3 })
    // Pas en dessous de la taille minimale, même en tirant au-delà du côté opposé.
    expect(resizeByHandle(r, 0, "w", 10, 0, big)).toEqual({ x: 13.8, y: 10, w: 0.2, h: 2 })
})

test("resizeByHandle sur un élément tourné garde le côté opposé en place à l'écran", () => {
    // Tourné de 90° : sa largeur est verticale à l'écran. Tirer la poignée « e »
    // vers le bas de l'écran l'allonge, et le côté « w » reste fixe.
    const r = { x: 10, y: 10, w: 4, h: 2 }
    const out = resizeByHandle(r, 90, "e", 0, 1, big)
    expect(out.w).toBe(5)
    expect(out.h).toBe(2)
    // Tourné de 90°, l'axe de la largeur pointe vers le bas de l'écran : le
    // côté « w » est en haut, à y = centre − w/2.
    const westBefore = r.y + r.h / 2 - r.w / 2 // 11 − 2 = 9
    const westAfter = out.y + out.h / 2 - out.w / 2 // 11,5 − 2,5 = 9
    expect(westAfter).toBeCloseTo(westBefore)
    // Et l'élément ne glisse pas de côté.
    expect(out.x + out.w / 2).toBeCloseTo(r.x + r.w / 2)
})

test("une porte tournée de 90° se colle au mur de droite", () => {
    const bounds = { width: 10, depth: 8 }
    // Porte 1,4 × 0,2 tournée : 0,2 m de large à l'écran, centrée à 9,9 contre le mur.
    const door = { x: 8, y: 3, w: 1.4, h: 0.2 }
    const moved = moveRect(door, 5, 0, bounds, 90)
    expect(moved.x + moved.w / 2).toBeCloseTo(9.9)
    // Sans rotation, c'est toute sa largeur qui bute.
    expect(moveRect(door, 5, 0, bounds).x).toBeCloseTo(8.6)
})
