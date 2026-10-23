import { beforeEach, expect, rstest, test } from "@rstest/core"

const mocks = rstest.hoisted(() => {
    const calls: { table: string; method: string; args: unknown[] }[] = []
    const results: { error: unknown }[] = []
    const from = rstest.fn((table: string) => {
        const builder: Record<string, unknown> = {}
        for (const method of ["update", "eq"]) {
            builder[method] = (...args: unknown[]) => {
                calls.push({ table, method, args })
                return builder
            }
        }
        builder.then = (resolve: (v: unknown) => void) => resolve(results.shift() ?? { error: null })
        return builder
    })
    return { calls, results, from }
})

rstest.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }))

import { saveGeometries } from "./planMagasinService"

beforeEach(() => {
    mocks.calls.length = 0
    mocks.results.length = 0
})

const geometry = { pos_x: 1, pos_y: 2, width: 3, height: 4, rotation: 0 }

test("saveGeometries écrit chaque élément dans sa table", async () => {
    await saveGeometries([
        { type: "zone", id: "z1", geometry },
        { type: "emplacement", id: "e1", geometry },
        { type: "equipement", id: "q1", geometry },
    ])
    expect(mocks.calls).toEqual([
        { table: "zones_magasin", method: "update", args: [geometry] },
        { table: "zones_magasin", method: "eq", args: ["id", "z1"] },
        { table: "emplacements_magasin", method: "update", args: [geometry] },
        { table: "emplacements_magasin", method: "eq", args: ["id", "e1"] },
        { table: "equipements_magasin", method: "update", args: [geometry] },
        { table: "equipements_magasin", method: "eq", args: ["id", "q1"] },
    ])
})

test("saveGeometries remonte la première erreur", async () => {
    const error = { code: "42501", message: "denied" }
    mocks.results.push({ error: null }, { error })
    await expect(
        saveGeometries([
            { type: "zone", id: "z1", geometry },
            { type: "zone", id: "z2", geometry },
        ]),
    ).rejects.toBe(error)
})
