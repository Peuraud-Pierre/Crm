import { expect, test } from "@rstest/core"
import { QueryClient, type InfiniteData } from "@tanstack/react-query"
import {
    belongsToScope,
    columnKey,
    findClientInCaches,
    parseClientRow,
    removeClientFromCaches,
    tableKey,
    upsertClientInCaches,
} from "./useClientsCache"
import type { Client } from "@/features/crm/types"

const pages = (...lists: Client[][]): InfiniteData<Client[]> => ({
    pages: lists,
    pageParams: lists.map((_, i) => i),
})
const ids = (qc: QueryClient, key: readonly unknown[]) =>
    (qc.getQueryData<InfiniteData<Client[]>>(key)?.pages.flat() ?? []).map(
        (c) => c.id
    )
const client = (id: string, collum: number, owner: string | null, updated_at = "2026-01-01") =>
    ({ id, collum, customer: owner ? { user_id: owner } : null, updated_at }) as unknown as Client

test("parseClientRow parse le brief JSON et capitalise le nom", () => {
    const c = parseClientRow({ nom: "jean dupont", brief: '{"budget":10}', customer: "u1" })
    expect(c.brief).toEqual({ budget: 10 })
    expect(c.nom).toBe("Jean Dupont")
    // customer brut (UUID) → null : la forme jointe seule est conservée.
    expect(c.customer).toBeNull()
})

test("belongsToScope : mes leads, pool « Nouveau lead », colonnes partagées", () => {
    expect(belongsToScope(client("a", 3, "u1"), "u1")).toBe(true)
    expect(belongsToScope(client("a", 3, "u2"), "u1")).toBe(false)
    expect(belongsToScope(client("a", 0, null), "u1")).toBe(true)
    expect(belongsToScope(client("a", 3, null), "u1")).toBe(false)
    // Owner brut (UUID string), comme dans un payload realtime.
    expect(belongsToScope({ collum: 3, customer: "u1" }, "u1")).toBe(true)
    expect(belongsToScope(client("a", 3, "u2"), null)).toBe(true)
})

test("upsert déplace la carte d'une colonne à l'autre", () => {
    const qc = new QueryClient()
    qc.setQueryData(columnKey("u1", 1), pages([client("a", 1, "u1"), client("b", 1, "u1")]))
    qc.setQueryData(columnKey("u1", 3), pages([client("c", 3, "u1")]))

    upsertClientInCaches(qc, client("a", 3, "u1", "2026-02-01"))

    expect(ids(qc, columnKey("u1", 1))).toEqual(["b"])
    expect(ids(qc, columnKey("u1", 3))).toEqual(["a", "c"])
})

test("upsert respecte le périmètre de chaque liste", () => {
    const qc = new QueryClient()
    qc.setQueryData(columnKey("u1", 3), pages([client("c", 3, "u1")]))
    qc.setQueryData(columnKey(null, 3), pages([client("c", 3, "u1")]))
    qc.setQueryData(tableKey("u1"), pages([client("c", 3, "u1")]))

    // Lead réassigné à u2 : il sort des listes de u1, reste dans « tous ».
    upsertClientInCaches(qc, client("c", 3, "u2", "2026-02-01"))

    expect(ids(qc, columnKey("u1", 3))).toEqual([])
    expect(ids(qc, tableKey("u1"))).toEqual([])
    expect(ids(qc, columnKey(null, 3))).toEqual(["c"])
})

test("upsert ignore une version plus ancienne (fusion monotone)", () => {
    const qc = new QueryClient()
    qc.setQueryData(columnKey(null, 1), pages([client("a", 1, null, "2026-02-01")]))

    upsertClientInCaches(qc, client("a", 3, null, "2026-01-01"))

    expect(ids(qc, columnKey(null, 1))).toEqual(["a"])
    expect(findClientInCaches(qc, "a")?.collum).toBe(1)
})

test("remove retire le client de toutes les listes", () => {
    const qc = new QueryClient()
    qc.setQueryData(columnKey(null, 1), pages([client("a", 1, null)], [client("b", 1, null)]))
    qc.setQueryData(tableKey(null), pages([client("a", 1, null)]))

    removeClientFromCaches(qc, "a")

    expect(ids(qc, columnKey(null, 1))).toEqual(["b"])
    expect(ids(qc, tableKey(null))).toEqual([])
})
