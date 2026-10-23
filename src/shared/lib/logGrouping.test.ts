import { expect, test } from "@rstest/core"
import { groupLogs, type GroupableLog } from "./logGrouping"

const WINDOW = 120_000 // 2 minutes, la valeur des deux modules de stock

const base = new Date("2026-03-04T12:00:00.000Z").getTime()

/** `secondsAgo` compté depuis `base` : les journaux arrivent du plus récent au plus ancien. */
function log(id: string, secondsAgo: number, over: Partial<GroupableLog> = {}): GroupableLog {
    return {
        id,
        created_at: new Date(base - secondsAgo * 1000).toISOString(),
        user_id: "u1",
        action: "create",
        entity_type: "balle",
        ...over,
    }
}

const keys = (groups: { entries: GroupableLog[] }[]) => groups.map((g) => g.entries.map((e) => e.id))

test("une liste vide ne produit aucun groupe", () => {
    expect(groupLogs([], { windowMs: WINDOW, anchor: "head" })).toEqual([])
})

test("des entrées rapprochées et de même contexte forment un seul groupe", () => {
    const logs = [log("a", 0), log("b", 10), log("c", 20)]

    expect(keys(groupLogs(logs, { windowMs: WINDOW, anchor: "head" }))).toEqual([
        ["a", "b", "c"],
    ])
})

test("un changement d'utilisateur rompt le groupe", () => {
    const logs = [log("a", 0), log("b", 10, { user_id: "u2" })]

    expect(keys(groupLogs(logs, { windowMs: WINDOW, anchor: "head" }))).toEqual([["a"], ["b"]])
})

test("un changement d'action rompt le groupe", () => {
    const logs = [log("a", 0), log("b", 10, { action: "update" })]

    expect(keys(groupLogs(logs, { windowMs: WINDOW, anchor: "head" }))).toEqual([["a"], ["b"]])
})

test("un changement de type d'entité rompt le groupe", () => {
    const logs = [log("a", 0), log("b", 10, { entity_type: "mouvement" })]

    expect(keys(groupLogs(logs, { windowMs: WINDOW, anchor: "head" }))).toEqual([["a"], ["b"]])
})

test("le groupe porte l'id et l'horodatage de son entrée d'ouverture", () => {
    const logs = [log("a", 0), log("b", 10)]
    const [group] = groupLogs(logs, { windowMs: WINDOW, anchor: "head" })

    expect(group.key).toBe("a")
    expect(group.created_at).toBe(logs[0].created_at)
})

// ─── Le point où les deux modules divergeaient ────────────────────────────────

test("anchor head : une salve plus longue que la fenêtre se scinde", () => {
    // Entrées espacées de 60 s, fenêtre de 120 s. Mesurée depuis la tête, la
    // quatrième (à 180 s) sort de la fenêtre et ouvre un nouveau groupe.
    const logs = [log("a", 0), log("b", 60), log("c", 120), log("d", 180)]

    expect(keys(groupLogs(logs, { windowMs: WINDOW, anchor: "head" }))).toEqual([
        ["a", "b", "c"],
        ["d"],
    ])
})

test("anchor last : la même salve reste un seul groupe", () => {
    // Fenêtre glissante : chaque entrée est à 60 s de la précédente, donc
    // toujours dans la fenêtre. Une salve continue ne se scinde jamais.
    const logs = [log("a", 0), log("b", 60), log("c", 120), log("d", 180)]

    expect(keys(groupLogs(logs, { windowMs: WINDOW, anchor: "last" }))).toEqual([
        ["a", "b", "c", "d"],
    ])
})

test("anchor last : un trou plus large que la fenêtre rompt quand même le groupe", () => {
    const logs = [log("a", 0), log("b", 60), log("c", 300)]

    expect(keys(groupLogs(logs, { windowMs: WINDOW, anchor: "last" }))).toEqual([
        ["a", "b"],
        ["c"],
    ])
})

test("l'ordre chronologique inverse donne le même découpage", () => {
    // La fenêtre est mesurée en valeur absolue : un service qui renverrait ses
    // entrées du plus ancien au plus récent regrouperait à l'identique.
    const logs = [log("d", 180), log("c", 120), log("b", 60), log("a", 0)]

    expect(keys(groupLogs(logs, { windowMs: WINDOW, anchor: "last" }))).toEqual([
        ["d", "c", "b", "a"],
    ])
})
