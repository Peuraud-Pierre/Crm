import { beforeEach, expect, rstest, test } from "@rstest/core"
import { act, renderHook, waitFor } from "@testing-library/react"

const mocks = rstest.hoisted(() => ({
    fetchZones: rstest.fn(),
    fetchEmplacements: rstest.fn(),
    fetchEquipements: rstest.fn(),
    insertZone: rstest.fn(),
    insertEquipement: rstest.fn(),
    fetchMurs: rstest.fn(),
}))

rstest.mock("@/features/magasins/services/planMagasinService", () => mocks)
rstest.mock("@/features/magasins/services/murService", () => ({ fetchMurs: mocks.fetchMurs }))
rstest.mock("sonner", () => ({ toast: { success: rstest.fn(), error: rstest.fn() } }))

import { emplacement, equipement, zone } from "../../__fixtures__/plan"
import { usePlanMagasin } from "./usePlanMagasin"

beforeEach(() => {
    rstest.clearAllMocks()
    mocks.fetchZones.mockResolvedValue([
        zone("a", "A", "zone"),
        zone("r", "R1", "rayon", "a"),
        zone("b", "A", "zone", null, { etage_id: "e1" }),
    ])
    mocks.fetchEmplacements.mockResolvedValue([emplacement("h1", "H1", "r"), emplacement("h2", "H2", "b")])
    mocks.fetchEquipements.mockResolvedValue([equipement("c1", "C1", "caisse"), { ...equipement("c2", "C1", "caisse"), etage_id: "e1" }])
    mocks.insertZone.mockResolvedValue(zone("n", "N", "zone"))
    mocks.fetchMurs.mockResolvedValue([
        { id: "w1", magasin_id: "m1", etage_id: "rdc", points: [[0, 0], [4, 0]], epaisseur: 0.15, hauteur: 2.5 },
        { id: "w2", magasin_id: "m1", etage_id: "e1", points: [[0, 0], [4, 0]], epaisseur: 0.15, hauteur: 2.5 },
        { id: "w3", magasin_id: "m1", etage_id: "e1", points: [[0, 0], [0, 4]], epaisseur: 0.1, hauteur: 2.5 },
    ])
})

async function setup(etageId: string | null) {
    const hook = renderHook(({ id }) => usePlanMagasin("m1", id), { initialProps: { id: etageId } })
    await waitFor(() => expect(hook.result.current.loading).toBe(false))
    return hook
}

test("seul l'étage affiché est renvoyé, et l'on change d'étage sans recharger", async () => {
    const hook = await setup("rdc")
    expect(hook.result.current.zones.map((z) => z.id)).toEqual(["a", "r"])
    expect(hook.result.current.emplacements.map((e) => e.id)).toEqual(["h1"])
    expect(hook.result.current.equipements.map((q) => q.id)).toEqual(["c1"])

    expect(hook.result.current.murs.map((m) => m.id)).toEqual(["w1"])

    hook.rerender({ id: "e1" })
    expect(hook.result.current.murs.map((m) => m.id)).toEqual(["w2", "w3"])
    expect(hook.result.current.items.map((i) => i.id)).toEqual(["b", "h2", "c2"])
    expect(mocks.fetchZones).toHaveBeenCalledTimes(1)
})

test("contentOf compte le contenu de n'importe quel étage", async () => {
    const hook = await setup("rdc")
    expect(hook.result.current.contentOf("rdc")).toEqual({ zones: 2, emplacements: 1, equipements: 1, murs: 1 })
    expect(hook.result.current.contentOf("e1")).toEqual({ zones: 1, emplacements: 1, equipements: 1, murs: 2 })
})

test("une zone créée se range dans l'étage affiché", async () => {
    const hook = await setup("e1")
    await act(() =>
        hook.result.current.createZone({ kind: "zone", parent_id: null, code: "N", label: null, color: null, is_active: true }),
    )
    expect(mocks.insertZone).toHaveBeenCalledWith("m1", expect.objectContaining({ code: "N", etage_id: "e1" }))
})

test("murs indisponibles (base pas à jour) : le reste du plan se charge quand même", async () => {
    mocks.fetchMurs.mockRejectedValue({ code: "PGRST205", message: "Could not find the table 'public.murs_magasin'" })
    const hook = await setup("rdc")
    expect(hook.result.current.error).toBeNull()
    expect(hook.result.current.zones.map((z) => z.id)).toEqual(["a", "r"])
    expect(hook.result.current.equipements.map((q) => q.id)).toEqual(["c1"])
    expect(hook.result.current.murs).toEqual([])
    expect(hook.result.current.mursUnavailable).toBe(true)
})
