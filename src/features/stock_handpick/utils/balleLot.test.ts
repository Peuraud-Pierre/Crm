import { expect, test } from "@rstest/core"
import type { BalleHandpickFormInput } from "@/features/stock_handpick/types/balle.types"
import { buildLotPayloads, duplicateLine, emptyLine } from "./balleLot"

/**
 * Création en lot : les champs communs (usine, date, statut, notes) sont
 * recopiés sur chaque balle, les champs de ligne lui sont propres.
 */

const COMMON = {
    fournisseur_id: "usine-1",
    import_date: "2026-09-23T00:00:00.000Z",
    status: "stocked",
    notes: "Arrivage lundi",
    type: null,
} as BalleHandpickFormInput

test("une balle par ligne, champs communs recopiés", () => {
    const lines = [
        { ...emptyLine(), category_id: "c1", packing: 120, emplacement_id: "e1" },
        { ...emptyLine(), category_id: "c2", packing: 80, packing_mode: "pieces" as const, emplacement_id: "e1" },
    ]

    const payloads = buildLotPayloads(COMMON, lines)

    expect(payloads).toHaveLength(2)
    expect(payloads.map((p) => p.fournisseur_id)).toEqual(["usine-1", "usine-1"])
    expect(payloads.map((p) => p.notes)).toEqual(["Arrivage lundi", "Arrivage lundi"])
    expect(payloads.map((p) => [p.category_id, p.packing, p.packing_mode])).toEqual([
        ["c1", 120, "kilos"],
        ["c2", 80, "pieces"],
    ])
})

test("rangée → entrepôt ; sans emplacement → pas de situation", () => {
    const [placed, unplaced] = buildLotPayloads(COMMON, [
        { ...emptyLine(), emplacement_id: "e1" },
        emptyLine(),
    ])

    expect(placed.location).toBe("warehouse")
    expect(unplaced.location).toBeNull()
    expect(unplaced.emplacement_id).toBeNull()
})

test("dupliquer copie la ligne sous une nouvelle clé", () => {
    const line = { ...emptyLine(), category_id: "c1", packing: 50, emplacement_id: "e2" }
    const copy = duplicateLine(line)

    expect(copy.key).not.toBe(line.key)
    expect({ ...copy, key: line.key }).toEqual(line)
})
