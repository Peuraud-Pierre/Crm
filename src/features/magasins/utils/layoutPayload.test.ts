import { expect, test } from "@rstest/core"
import { EMPLACEMENTS, ZONES, equipement, zone } from "../__fixtures__/plan"
import type { Etage, Magasin, Mur } from "@/features/magasins/types/magasin.types"
import { buildLayoutPayload } from "./layoutPayload"

const magasin = { id: "m1", code: "LYO", nom: "Lyon", largeur: 20, profondeur: 15 } as Magasin
const etage = (id: string, niveau: number) => ({ id, nom: id, niveau, contour: null }) as Etage
const mur = { id: "w1", etage_id: "r1", points: [[0, 0], [5, 0]], epaisseur: 0.15, hauteur: 2.5 } as Mur

test("découpe le plan par étage, triés par niveau, emplacements suivant leur zone", () => {
    const payload = buildLayoutPayload(
        magasin,
        [etage("r1", 1), etage("rdc", 0)],
        [...ZONES, zone("haut", "H", "zone", null, { etage_id: "r1" })],
        EMPLACEMENTS,
        [equipement("c1", "C1", "caisse")],
        [mur],
    )
    expect(payload.version).toBe(1)
    expect(payload.magasin).toEqual({ id: "m1", code: "LYO", nom: "Lyon", largeur: 20, profondeur: 15 })
    expect(payload.etages.map((e) => e.id)).toEqual(["rdc", "r1"])
    const [rdc, r1] = payload.etages
    expect(rdc.items.map((i) => i.code).sort()).toEqual(["A", "B", "C1", "E1", "H1", "R1", "SOL"])
    expect(rdc.walls).toEqual([])
    expect(r1.items.map((i) => i.code)).toEqual(["H"])
    expect(r1.walls).toEqual([{ id: "w1", points: [[0, 0], [5, 0]], epaisseur: 0.15, hauteur: 2.5 }])
})
