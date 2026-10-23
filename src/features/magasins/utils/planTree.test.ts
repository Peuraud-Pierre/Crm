import { expect, test } from "@rstest/core"
import { EMPLACEMENTS, ZONES, equipement, zone } from "../__fixtures__/plan"
import { buildPlanItems, buildZoneTree, descendantZoneIds, emplacementsUnder, nextEquipementCode } from "./planTree"

test("buildZoneTree recompose l'arbre et y range les emplacements", () => {
    const tree = buildZoneTree(ZONES, EMPLACEMENTS)
    expect(tree.map((z) => z.code)).toEqual(["A", "B"])
    const r1 = tree[0].children[0]
    expect(r1.code).toBe("R1")
    expect(r1.children[0].emplacements.map((e) => e.code)).toEqual(["H1"])
    expect(tree[1].emplacements.map((e) => e.code)).toEqual(["SOL"])
})

test("une zone dont le parent manque reste visible, à la racine", () => {
    const tree = buildZoneTree([zone("x", "X", "rayon", "absent")], [])
    expect(tree.map((z) => z.code)).toEqual(["X"])
})

test("descendantZoneIds et emplacementsUnder suivent toute la descendance", () => {
    expect(descendantZoneIds("a", ZONES).sort()).toEqual(["a", "e1", "r1"])
    expect(emplacementsUnder("a", ZONES, EMPLACEMENTS).map((e) => e.code)).toEqual(["H1"])
    expect(emplacementsUnder("b", ZONES, EMPLACEMENTS).map((e) => e.code)).toEqual(["SOL"])
})

test("buildPlanItems : chemins, parents, ordre de dessin et couleur par zone racine", () => {
    const items = buildPlanItems(ZONES, EMPLACEMENTS)
    expect(items.map((i) => i.path)).toEqual(["A", "B", "A · R1", "A · R1 · E1", "A · R1 · E1 · H1", "B · SOL"])
    const h1 = items.find((i) => i.code === "H1")
    expect(h1).toMatchObject({ key: "e:h1", parentKey: "z:e1", type: "emplacement", colorIndex: 0 })
    expect(items.find((i) => i.code === "SOL")?.colorIndex).toBe(1)
    expect(items.find((i) => i.code === "A")?.parentKey).toBeNull()
})

test("les équipements se dessinent en dernier, hors de toute zone", () => {
    const items = buildPlanItems(ZONES, EMPLACEMENTS, [equipement("s", "S1", "sortie"), equipement("c", "C1", "caisse")])
    expect(items.slice(-2).map((i) => [i.key, i.type, i.parentKey])).toEqual([
        ["q:c", "equipement", null],
        ["q:s", "equipement", null],
    ])
})

test("nextEquipementCode numérote par type et comble les trous", () => {
    const existing = [equipement("1", "C1", "caisse"), equipement("2", "C3", "caisse"), equipement("3", "E1", "entree")]
    expect(nextEquipementCode("caisse", existing)).toBe("C2")
    expect(nextEquipementCode("entree", existing)).toBe("E2")
    expect(nextEquipementCode("sortie", existing)).toBe("S1")
    expect(nextEquipementCode("entree_sortie", [])).toBe("ES1")
})
