import { beforeEach, expect, rstest, test } from "@rstest/core"
import { act, renderHook, waitFor } from "@testing-library/react"
import type { PackingListLigne } from "@/features/stock/types/packing-list.types"

/**
 * Ce que l'annulation d'une décision doit garantir.
 *
 * Le point sensible n'est pas l'écran mais la VÉRITÉ de ce qu'on annonce :
 * le trigger `packing_label_feedback_record` ne supprime la trace
 * d'apprentissage d'une décision que si `category_id` repasse à `NULL`.
 * Restaurer une autre catégorie laisse l'exemple en base. La pile refuse donc
 * d'enregistrer un geste parti d'une ligne déjà classée — sans quoi l'écran
 * dirait « annulé » là où la base garderait la leçon.
 *
 * Le reste tient en une règle : toute relecture des lignes vide la pile, parce
 * qu'elle décrit alors un état qui n'existe plus.
 */

const mocks = rstest.hoisted(() => ({
    fetchLignes: rstest.fn(),
    assignGroup: rstest.fn(async () => {}),
    assignGroupUnmatched: rstest.fn(async () => {}),
    assignManyUnmatched: rstest.fn(async () => {}),
    assignLigne: rstest.fn(async () => {}),
    restoreLignes: rstest.fn(async () => {}),
    subscribeToPackingList: rstest.fn(() => () => {}),
    fetchMappingsForKeys: rstest.fn(async () => new Map()),
}))

rstest.mock("@/features/stock/services/packingListService", () => mocks)
rstest.mock("@/features/stock/services/packingLabelDictionaryService", () => ({
    fetchMappingsForKeys: mocks.fetchMappingsForKeys,
}))

import { usePackingList } from "./usePackingList"

let seq = 0

function ligne(over: Partial<PackingListLigne> = {}): PackingListLigne {
    seq += 1
    const raw = over.raw_label ?? "PLO RALLRT"
    return {
        id: `l-${seq}`,
        packing_list_id: "p1",
        position: seq,
        source_row: seq + 3,
        raw_label: raw,
        raw_label_key: raw.toLowerCase(),
        raw_row: null,
        package_count: 10,
        units_per_package: 200,
        unit_kind: "pcs",
        declared_total: 2000,
        suggested_category_id: "pull",
        match_confidence: 0.5,
        suggestion_source: "model",
        category_id: null,
        resolution: null,
        normalizer_version: 2,
        reviewed_at: null,
        reviewed_by: null,
        ...over,
    }
}

/** Monte le hook sur un jeu de lignes déjà chargé. */
async function mount(lignes: PackingListLigne[]) {
    mocks.fetchLignes.mockImplementation(async () => lignes)
    const view = renderHook(() => usePackingList("p1", rstest.fn()))
    await waitFor(() => expect(view.result.current.lignes).toHaveLength(lignes.length))
    return view
}

beforeEach(() => {
    // `clearAllMocks` efface les appels, pas les implémentations : sans ce
    // rétablissement, le mock en échec d'un test fait échouer les suivants.
    rstest.clearAllMocks()
    seq = 0
    mocks.subscribeToPackingList.mockImplementation(() => () => {})
    mocks.fetchMappingsForKeys.mockImplementation(async () => new Map())
    mocks.restoreLignes.mockImplementation(async () => {})
    mocks.assignGroup.mockImplementation(async () => {})
    mocks.assignGroupUnmatched.mockImplementation(async () => {})
    mocks.assignManyUnmatched.mockImplementation(async () => {})
    mocks.assignLigne.mockImplementation(async () => {})
})

test("une décision prise sur un libellé à classer devient annulable", async () => {
    const { result } = await mount([ligne({ raw_label: "MIX JKT" })])

    await act(async () => {
        await result.current.acceptGroup("mix jkt", "pull")
    })

    expect(result.current.undoLabels).toEqual(["MIX JKT"])
})

test("annuler remet la ligne à classer — et c'est ce NULL qui efface la leçon en base", async () => {
    const { result } = await mount([ligne({ raw_label: "MIX JKT" })])

    await act(async () => {
        await result.current.acceptGroup("mix jkt", "pull")
    })
    await act(async () => {
        await result.current.undo()
    })

    expect(mocks.restoreLignes).toHaveBeenCalledWith("p1", [
        { id: "l-1", category_id: null, resolution: null, reviewed_at: null },
    ])
    expect(result.current.lignes[0].category_id).toBeNull()
    expect(result.current.undoLabels).toEqual([])
})

test("corriger un libellé DÉJÀ classé ne s'annule pas : la base garderait la leçon", async () => {
    const { result } = await mount([
        ligne({ raw_label: "MIX JKT", category_id: "pull", resolution: "model" }),
    ])

    await act(async () => {
        await result.current.assignGroup("mix jkt", "jean")
    })

    expect(result.current.undoLabels).toEqual([])
})

test("une attribution de masse s'annule d'un seul geste", async () => {
    const { result } = await mount([
        ligne({ raw_label: "MIX JKT" }),
        ligne({ raw_label: "DENIM" }),
    ])

    await act(async () => {
        await result.current.acceptMany([
            { rawLabelKey: "mix jkt", categoryId: "pull" },
            { rawLabelKey: "denim", categoryId: "pull" },
        ])
    })

    expect(result.current.undoLabels).toEqual(["MIX JKT", "DENIM"])

    await act(async () => {
        await result.current.undo()
    })

    expect(mocks.restoreLignes).toHaveBeenCalledTimes(1)
    expect(result.current.lignes.every((l) => l.category_id === null)).toBe(true)
})

test("une écriture refusée recharge les lignes et vide la pile", async () => {
    // Sans ça, on proposerait d'annuler une décision que la base n'a jamais
    // enregistrée.
    const { result } = await mount([ligne({ raw_label: "MIX JKT" })])
    mocks.assignGroupUnmatched.mockImplementation(async () => {
        throw new Error("refusé")
    })
    const errSpy = rstest.spyOn(console, "error").mockImplementation(() => {})

    await act(async () => {
        await result.current.acceptGroup("mix jkt", "pull")
    })

    await waitFor(() => expect(result.current.undoLabels).toEqual([]))
    expect(errSpy).toHaveBeenCalledWith("[usePackingList]", expect.any(Error))
    errSpy.mockRestore()
})

test("la pile ne garde que les trois derniers gestes", async () => {
    const { result } = await mount([
        ligne({ raw_label: "A" }),
        ligne({ raw_label: "B" }),
        ligne({ raw_label: "C" }),
        ligne({ raw_label: "D" }),
    ])

    for (const key of ["a", "b", "c", "d"]) {
        await act(async () => {
            await result.current.acceptGroup(key, "pull")
        })
    }

    // Le plus ancien est sorti : trois annulations successives suffisent à
    // épuiser la pile.
    expect(result.current.undoLabels).toEqual(["D"])
    for (let i = 0; i < 3; i += 1) {
        await act(async () => {
            await result.current.undo()
        })
    }
    expect(result.current.undoLabels).toEqual([])
})
