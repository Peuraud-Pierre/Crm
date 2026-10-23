import { expect, test } from "@rstest/core"
import { equipement, zone } from "../__fixtures__/plan"
import { buildPlanItems } from "./planTree"
import { autoZoneLinks, zoneUnder } from "./mannequin"

const zA = { ...zone("za", "A", "zone"), pos_x: 0, pos_y: 0, width: 5, height: 5 }
const rayon = { ...zone("r1", "R1", "rayon", "za"), pos_x: 1, pos_y: 1, width: 2, height: 2 }
const mq = (id: string, zoneId: string | null) => ({ ...equipement(id, "MQ1", "mannequin"), zone_id: zoneId })

test("un mannequin rattaché prend place dans l'arborescence, comme un portant", () => {
    const items = buildPlanItems([zA, rayon], [], [mq("m", "r1")])
    const item = items.find((i) => i.id === "m")!
    expect(item.parentKey).toBe("z:r1")
    expect(item.path).toBe("A · R1 · MQ1")
})

test("posé dans un rayon, il s'y rattache ; hors de tout, il reste libre", () => {
    const items = buildPlanItems([zA, rayon], [], [])
    const at = (x: number, y: number) => ({ pos_x: x, pos_y: y, width: 0.5, height: 0.35, rotation: 0 })
    expect(zoneUnder(at(1.5, 1.5), items)).toBe("r1")
    expect(zoneUnder(at(4, 4), items)).toBe("za")
    expect(zoneUnder(at(8, 8), items)).toBeNull()
})

test("à l'enregistrement, seuls les mannequins sans zone sont rattachés", () => {
    const items = buildPlanItems([zA, rayon], [], [])
    const geometry = { pos_x: 1.5, pos_y: 1.5, width: 0.5, height: 0.35, rotation: 0 }
    const changes = [
        { type: "equipement", id: "libre", geometry },
        { type: "equipement", id: "deja", geometry },
        { type: "equipement", id: "caisse", geometry },
    ]
    const equipements = [mq("libre", null), mq("deja", "za"), { ...equipement("caisse", "C1", "caisse"), zone_id: null }]
    expect(autoZoneLinks(changes, equipements, items)).toEqual([{ id: "libre", zoneId: "r1" }])
})
