import { expect, test } from "@rstest/core"
import { IN_FILTER_MAX, chunk } from "./chunk"

test("découpe en paquets de taille fixe, le dernier plus court", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
})

test("un tableau vide ne donne aucun paquet", () => {
    expect(chunk([], 40)).toEqual([])
})

test("un lot de 85 ids part en 3 requêtes sous la limite du proxy", () => {
    const ids = Array.from({ length: 85 }, (_, i) => `id-${i}`)
    const parts = chunk(ids, IN_FILTER_MAX)

    expect(parts).toHaveLength(3)
    expect(parts.every((part) => part.length <= IN_FILTER_MAX)).toBe(true)
    expect(parts.flat()).toEqual(ids)
})
