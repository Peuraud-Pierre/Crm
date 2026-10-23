import { expect, test } from "@rstest/core"
import { EMPLACEMENTS, ZONES } from "../__fixtures__/plan"
import { buildPlanItems } from "./planTree"
import { deletionImpact } from "./deletion"

const items = buildPlanItems(ZONES, EMPLACEMENTS)
const byCode = (code: string) => items.find((i) => i.code === code)!

test("supprimer une zone annonce ses sous-niveaux et emplacements emportés", () => {
    // A › R1 › E1 › H1 : 2 sous-niveaux, 1 emplacement.
    expect(deletionImpact(byCode("A"), { zones: ZONES, emplacements: EMPLACEMENTS })).toBe(
        "Seront aussi supprimés : 2 sous-niveaux (rayons, portants) et 1 emplacement. Cette suppression est définitive.",
    )
    expect(deletionImpact(byCode("E1"), { zones: ZONES, emplacements: EMPLACEMENTS })).toMatch(/^Seront aussi supprimés : 1 emplacement\./)
})

test("un élément sans contenu, un emplacement ou un équipement : suppression simple", () => {
    expect(deletionImpact(byCode("H1"), { zones: ZONES, emplacements: EMPLACEMENTS })).toBe("Cette suppression est définitive.")
})
