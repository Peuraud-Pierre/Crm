import { describe, expect, test } from "@rstest/core"
import { DEFAULT_FLOOR, rotatePoint } from "./floorPlan"
import {
    elementBounds,
    elementRotation,
    freeRows,
    moveElement,
    normalizeLayout,
    removeElement,
    resizeElement,
    rotateBy,
    rotateElement,
    segmentAngle,
    setRotation,
    updateElement,
} from "./floorPlanEdit"
import { addElement } from "./floorPlanTemplates"

/**
 * L'éditeur de plan repose sur ces fonctions pures : elles ne doivent jamais
 * modifier la disposition reçue, et doivent accrocher à la grille de 10 cm.
 */

describe("déplacement", () => {
    test("un rack se déplace avec accroche à la grille, sans toucher l'original", () => {
        const next = moveElement(DEFAULT_FLOOR, { kind: "rack", id: "R1" }, 1.04, -0.23)
        const before = DEFAULT_FLOOR.racks.find((r) => r.id === "R1")!.rect
        const after = next.racks.find((r) => r.id === "R1")!.rect
        expect(after.x).toBeCloseTo(before.x + 1.0)
        expect(after.z).toBeCloseTo(before.z - 0.2)
        expect(after.w).toBe(before.w)
        expect(DEFAULT_FLOOR.racks.find((r) => r.id === "R1")!.rect).toBe(before)
    })

    test("une porte se déplace d'un bloc, ses deux extrémités ensemble", () => {
        const door = DEFAULT_FLOOR.doors[0]
        const next = moveElement(DEFAULT_FLOOR, { kind: "door", id: door.id }, 2, 0)
        const moved = next.doors.find((d) => d.id === door.id)!
        expect(moved.from[0]).toBeCloseTo(door.from[0] + 2)
        expect(moved.to[0]).toBeCloseTo(door.to[0] + 2)
    })

    test("une colonne et un point de dépose se déplacent", () => {
        const pillar = DEFAULT_FLOOR.pillars[0]
        let next = moveElement(DEFAULT_FLOOR, { kind: "pillar", id: pillar.id }, 0.5, 0.5)
        next = moveElement(next, { kind: "baleSpot", id: "D" }, -1, 0)
        expect(next.pillars[0].x).toBeCloseTo(pillar.x + 0.5)
        expect(next.baleSpots.D.x).toBeCloseTo(DEFAULT_FLOOR.baleSpots.D.x - 1)
    })
})

describe("taille et rotation", () => {
    test("un redimensionnement ne descend pas sous la taille minimale", () => {
        const next = resizeElement(DEFAULT_FLOOR, { kind: "office", id: "bureau-1" }, 0, 5.03)
        const rect = next.offices.find((o) => o.id === "bureau-1")!.rect
        expect(rect.w).toBe(0.2)
        expect(rect.d).toBeCloseTo(5.0)
    })

    test("pivoter échange largeur et profondeur autour du centre, et l'axe suit", () => {
        const ref = { kind: "fixture" as const, id: "ilot-5" }
        const before = DEFAULT_FLOOR.fixtures.find((f) => f.id === ref.id)!
        const after = rotateElement(DEFAULT_FLOOR, ref).fixtures.find((f) => f.id === ref.id)!
        expect(after.rect.w).toBe(before.rect.d)
        expect(after.rect.d).toBe(before.rect.w)
        expect(after.axis).toBe(before.axis === "z" ? "x" : "z")
        expect(after.rect.x + after.rect.w / 2).toBeCloseTo(before.rect.x + before.rect.w / 2, 0)
    })
})

describe("suppression", () => {
    test("un meuble se retire du plan", () => {
        const next = removeElement(DEFAULT_FLOOR, { kind: "fixture", id: "mannequin" })
        expect(next.fixtures.some((f) => f.id === "mannequin")).toBe(false)
        expect(next.fixtures).toHaveLength(DEFAULT_FLOOR.fixtures.length - 1)
    })

    test("une zone ne se supprime jamais", () => {
        const next = removeElement(DEFAULT_FLOOR, { kind: "zone", id: "B" })
        expect(next.zones.B).toBe(DEFAULT_FLOOR.zones.B)
    })
})

describe("ajout", () => {
    test("un meuble ajouté est centré sur le point voulu, avec un identifiant libre", () => {
        const result = addElement(DEFAULT_FLOOR, "fixture:island", { x: 20, z: 20 })!
        expect(result.ref.kind).toBe("fixture")
        const added = result.floor.fixtures.find((f) => f.id === result.ref.id)!
        expect(added.kind).toBe("island")
        expect(added.rect.x + added.rect.w / 2).toBeCloseTo(20)
        expect(DEFAULT_FLOOR.fixtures.some((f) => f.id === result.ref.id)).toBe(false)
        expect(elementBounds(result.floor, result.ref)).not.toBeNull()
    })

    test("chaque famille peut être ajoutée", () => {
        for (const id of ["rack", "office", "door", "wall", "pillar"]) {
            const result = addElement(DEFAULT_FLOOR, id, { x: 10, z: 10 })
            expect(result).not.toBeNull()
            expect(elementBounds(result!.floor, result!.ref)).not.toBeNull()
        }
    })

    test("un rack ajouté n'est rattaché à aucune rangée tant qu'on ne le choisit pas", () => {
        const result = addElement(DEFAULT_FLOOR, "rack", { x: 10, z: 10 })!
        expect(result.floor.racks.find((r) => r.id === result.ref.id)!.row).toBeNull()
    })
})

describe("rangées adressables", () => {
    test("une rangée n'est proposée que si aucun rack ne la porte", () => {
        expect(freeRows(DEFAULT_FLOOR)).toEqual([])
        const without = removeElement(DEFAULT_FLOOR, { kind: "rack", id: "R4" })
        expect(freeRows(without)).toEqual(["R4"])
    })

    test("changer la rangée d'un rack libère l'ancienne", () => {
        const next = updateElement(DEFAULT_FLOOR, { kind: "rack", id: "R5" }, { row: null })
        expect(freeRows(next)).toEqual(["R5"])
    })
})

describe("relecture depuis la base", () => {
    test("une valeur illisible retombe sur la disposition par défaut", () => {
        expect(normalizeLayout(null)).toBe(DEFAULT_FLOOR)
        expect(normalizeLayout("x")).toBe(DEFAULT_FLOOR)
    })

    test("les clés absentes sont complétées, les présentes conservées", () => {
        const layout = normalizeLayout({ pillars: [], zones: { A: { x: 1, z: 1, w: 2, d: 2 } } })
        expect(layout.pillars).toEqual([])
        expect(layout.zones.A).toEqual({ x: 1, z: 1, w: 2, d: 2 })
        expect(layout.zones.B).toBe(DEFAULT_FLOOR.zones.B)
        expect(layout.racks).toBe(DEFAULT_FLOOR.racks)
    })
})

describe("angle libre", () => {
    test("un meuble se met en diagonale, l'angle est ramené dans ]-180, 180]", () => {
        const ref = { kind: "fixture" as const, id: "ilot-1" }
        let next = setRotation(DEFAULT_FLOOR, ref, 45)
        expect(elementRotation(next, ref)).toBe(45)
        next = rotateBy(next, ref, 300)
        expect(elementRotation(next, ref)).toBe(-15)
        // Le rectangle de base ne bouge pas : l'angle s'applique autour de son centre.
        expect(next.fixtures.find((f) => f.id === ref.id)!.rect).toEqual(
            DEFAULT_FLOOR.fixtures.find((f) => f.id === ref.id)!.rect,
        )
    })

    test("revenir à 0° retire l'angle enregistré", () => {
        const ref = { kind: "rack" as const, id: "R1" }
        const next = setRotation(setRotation(DEFAULT_FLOOR, ref, 30), ref, 360)
        expect(next.racks.find((r) => r.id === "R1")!.rotation).toBeUndefined()
    })

    test("une cloison tourne autour de son milieu, jusqu'à l'angle demandé", () => {
        const ref = { kind: "wall" as const, id: "cloison-annexe" }
        const before = DEFAULT_FLOOR.innerWalls.find((w) => w.id === ref.id)!
        const next = setRotation(DEFAULT_FLOOR, ref, 45)
        const after = next.innerWalls.find((w) => w.id === ref.id)!
        expect(segmentAngle(next, ref)).toBe(45)
        expect((after.from[0] + after.to[0]) / 2).toBeCloseTo((before.from[0] + before.to[0]) / 2, 1)
        expect(Math.hypot(after.to[0] - after.from[0], after.to[1] - after.from[1])).toBeCloseTo(
            Math.hypot(before.to[0] - before.from[0], before.to[1] - before.from[1]),
            1,
        )
    })

    test("la rotation d'un point suit la convention du SVG (sens horaire, z vers le bas)", () => {
        const p = rotatePoint(1, 0, 0, 0, 90)
        expect(p.x).toBeCloseTo(0)
        expect(p.z).toBeCloseTo(1)
    })
})

describe("mobilier courant", () => {
    test("canapé et table s'ajoutent depuis la structure, avec leur libellé", () => {
        for (const [templateId, kind, label] of [
            ["fixture:sofa", "sofa", "Canapé"],
            ["fixture:table", "table", "Table"],
        ] as const) {
            const result = addElement(DEFAULT_FLOOR, templateId, { x: 20, z: 20 })!
            const added = result.floor.fixtures.find((f) => f.id === result.ref.id)!
            expect(added.kind).toBe(kind)
            expect(added.label).toBe(label)
        }
    })
})
