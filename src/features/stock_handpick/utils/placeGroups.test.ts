import { expect, test } from "@rstest/core"
import type { BalleHandpick } from "@/features/stock_handpick/types/balle.types"
import {
    PLACE_BORROWED,
    PLACE_ECLATEE,
    PLACE_UNPLACED,
    groupBallesByPlace,
    matchesPlace,
    placeFilterKeys,
    placeLabel,
} from "./placeGroups"

/**
 * L'inventaire affiche les balles là où elles sont stockées : ces règles
 * décident du groupe de chaque balle et de ce que retient le filtre.
 */

const PATHS: Record<string, string[]> = {
    "b-r2-e3-h1": ["B", "R2", "E3", "H1"],
    "b-r2-e1-h0": ["B", "R2", "E1", "H0"],
    "b-r1-e5-h2": ["B", "R1", "E5", "H2"],
    "a-sol": ["A", "SOL"],
    "d-sol": ["D", "SOL"],
}
const segmentsFor = (id: string | null | undefined) => (id ? PATHS[id] ?? null : null)

function balle(id: string, over: Partial<BalleHandpick> = {}): BalleHandpick {
    return { id, emplacement_id: null, borrowed_by: null, location: null, ...over } as BalleHandpick
}

const BALLES = [
    balle("1", { emplacement_id: "b-r2-e3-h1" }),
    balle("2", { emplacement_id: "d-sol" }),
    balle("3", { emplacement_id: "b-r2-e1-h0" }),
    balle("4", { location: "reception" }),
    balle("5", { borrowed_by: "u1", location: "handpick" }),
    balle("6", { emplacement_id: "b-r1-e5-h2" }),
    balle("7", { emplacement_id: "a-sol" }),
    balle("8"),
]

test("les balles sont regroupées par rack puis par zone, dans l'ordre du plan", () => {
    const groups = groupBallesByPlace(BALLES, segmentsFor)

    expect(groups.map((g) => g.key)).toEqual([
        "B/R1",
        "B/R2",
        "A",
        "D",
        PLACE_BORROWED,
        `${PLACE_UNPLACED}:reception`,
        `${PLACE_UNPLACED}:none`,
    ])
})

test("dans un rack, les balles suivent l'ordre des travées et des hauteurs", () => {
    const r2 = groupBallesByPlace(BALLES, segmentsFor).find((g) => g.key === "B/R2")!

    expect(r2.balles.map((b) => b.id)).toEqual(["3", "1"])
})

test("une balle empruntée n'est plus comptée à son emplacement", () => {
    const moved = balle("9", { emplacement_id: "b-r1-e5-h2", borrowed_by: "u2" })

    expect(matchesPlace(moved, "B", segmentsFor)).toBe(false)
    expect(matchesPlace(moved, PLACE_BORROWED, segmentsFor)).toBe(true)
})

test("le filtre retient une zone, un rack ou une travée", () => {
    const pick = (place: string) =>
        BALLES.filter((b) => matchesPlace(b, place, segmentsFor)).map((b) => b.id)

    expect(pick("B")).toEqual(["1", "3", "6"])
    expect(pick("B/R2")).toEqual(["1", "3"])
    expect(pick("B/R2/E3")).toEqual(["1"])
    expect(pick(PLACE_UNPLACED)).toEqual(["4", "8"])
})

test("un préfixe ne déborde pas sur un code voisin", () => {
    const r1 = balle("10", { emplacement_id: "b-r1-e5-h2" })

    // « B/R1 » ne doit pas retenir un futur « B/R10 », ni l'inverse.
    expect(matchesPlace(r1, "B/R", segmentsFor)).toBe(false)
})

test("les libellés nomment zone et rack", () => {
    expect(placeLabel("B/R2")).toBe("Zone B · Bags — R2 · Double haut")
    expect(placeLabel("D")).toBe("Zone D · Display")
    expect(placeLabel(PLACE_BORROWED)).toBe("Empruntées")
})

test("le filtre propose chaque zone et chaque rack", () => {
    expect(placeFilterKeys(Object.values(PATHS))).toEqual(["B", "B/R1", "B/R2", "A", "D"])
})

test("une balle éclatée a son propre groupe, pas « Non rangées »", () => {
    const eclatee = balle("11", { is_eclatee: true, location: "warehouse" })
    const groups = groupBallesByPlace([...BALLES, eclatee], segmentsFor)

    const last = groups[groups.length - 1]
    expect(last).toMatchObject({ key: PLACE_ECLATEE, label: "Éclatées" })
    expect(last.balles.map((b) => b.id)).toEqual(["11"])
    expect(groups.some((g) => g.key === `${PLACE_UNPLACED}:warehouse`)).toBe(false)

    expect(matchesPlace(eclatee, PLACE_ECLATEE, segmentsFor)).toBe(true)
    expect(matchesPlace(eclatee, PLACE_UNPLACED, segmentsFor)).toBe(false)
})
