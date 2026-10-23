import { describe, expect, test } from "@rstest/core"
import {
    buildClientTaskMap,
    computeOverlapGroups,
    filterClients,
    groupAndSortBoard,
    groupEventsByOwner,
} from "./crmCompute"
import type { Client, FicheAppro } from "@/features/crm/hooks/CRM_hook/use_client"
import type { Tache } from "@/features/crm/hooks/CRM_hook/use_tache"
import type { Event_creation } from "@/features/crm/hooks/CRM_hook/use_calendar"

const today = new Date()
const isoDay = (offset: number) => {
    const d = new Date(today)
    d.setDate(d.getDate() + offset)
    return d.toISOString()
}

const mkClient = (overrides: Partial<Client> = {}): Client => ({
    id: "c1",
    nom: "Client 1",
    societe: null,
    telephone: null,
    mail: null,
    siret: null,
    localisation: null,
    collum: 0,
    created_at: today.toISOString(),
    updated_at: today.toISOString(),
    customer: null,
    closers: null,
    ...overrides,
})

describe("buildClientTaskMap", () => {
    test("classe les clients par statut de tâche", () => {
        const clients = [
            mkClient({ id: "today" }),
            mkClient({ id: "future" }),
            mkClient({ id: "past" }),
            mkClient({ id: "empty" }),
        ]
        const tasks: Tache[] = [
            { id: "t1", type: "x", client: "today", content: null, date: today.toISOString() },
            { id: "t2", type: "x", client: "future", content: null, date: isoDay(5) },
            { id: "t3", type: "x", client: "past", content: null, date: isoDay(-1) },
        ]
        const map = buildClientTaskMap(clients, tasks)
        expect(map.get("today")).toBe("green")
        expect(map.get("future")).toBe("gray")
        expect(map.get("past")).toBe("red")
        expect(map.get("empty")).toBe("notask")
    })

    test("renvoie une map vide quand données manquantes", () => {
        expect(buildClientTaskMap(null, null).size).toBe(0)
    })
})

describe("filterClients", () => {
    const baseInput = {
        searchTerm: "",
        filters: {
            user: "none",
            date: "all" as const,
            experience: "all" as const,
            task: "all" as const,
        },
        clientTaskMap: new Map(),
        visibleColsIndices: [0, 1, 2, 3, 4, 5, 6, 7, 8],
    }

    test("filtre par terme de recherche", () => {
        const clients = [
            mkClient({ id: "a", nom: "Alice" }),
            mkClient({ id: "b", nom: "Bob" }),
        ]
        const res = filterClients(clients, { ...baseInput, searchTerm: "ali" })
        expect(res).toHaveLength(1)
        expect(res[0].id).toBe("a")
    })

    test("exclut les colonnes non visibles", () => {
        const clients = [
            mkClient({ id: "a", collum: 0 }),
            mkClient({ id: "b", collum: 5 }),
        ]
        const res = filterClients(clients, {
            ...baseInput,
            visibleColsIndices: [0, 1, 2],
        })
        expect(res).toHaveLength(1)
        expect(res[0].id).toBe("a")
    })

    test("filtre par expérience", () => {
        const clients = [
            mkClient({
                id: "a",
                brief: { experience: "+ 3 ans" } as FicheAppro,
            }),
            mkClient({
                id: "b",
                brief: { experience: "0 - 1 ans" } as FicheAppro,
            }),
        ]
        const res = filterClients(clients, {
            ...baseInput,
            filters: { ...baseInput.filters, experience: "high" },
        })
        expect(res.map((c) => c.id)).toEqual(["a"])
    })
})

describe("groupAndSortBoard", () => {
    test("regroupe par colonne et expose visibleCols", () => {
        const clients = [
            mkClient({ id: "a", collum: 0 }),
            mkClient({ id: "b", collum: 1 }),
        ]
        const { groups, visibleCols } = groupAndSortBoard(clients, "acquisition")
        expect(visibleCols).toContain("Nouveau lead")
        expect(groups["Nouveau lead"].map((c) => c.id)).toEqual(["a"])
    })

    test("trie par updated_at DESC (activité récente en haut)", () => {
        const clients = [
            mkClient({ id: "old", collum: 0, updated_at: "2026-01-01T00:00:00Z" }),
            mkClient({ id: "newest", collum: 0, updated_at: "2026-05-01T00:00:00Z" }),
            mkClient({ id: "middle", collum: 0, updated_at: "2026-03-01T00:00:00Z" }),
        ]
        const { groups } = groupAndSortBoard(clients, "acquisition")
        expect(groups["Nouveau lead"].map((c) => c.id)).toEqual([
            "newest",
            "middle",
            "old",
        ])
    })
})

describe("groupEventsByOwner", () => {
    test("regroupe par customer (objet ou string) et nomme la colonne", () => {
        const events: Event_creation[] = [
            {
                debut: today.toISOString(),
                fin: today.toISOString(),
                participants: null,
                lieu: null,
                description: null,
                customer: { id: "u1", full_name: "Alice" },
            },
            {
                debut: today.toISOString(),
                fin: today.toISOString(),
                participants: null,
                lieu: null,
                description: null,
                customer: "u2",
                owner: "Bob",
            },
            {
                debut: today.toISOString(),
                fin: today.toISOString(),
                participants: null,
                lieu: null,
                description: null,
                customer: null,
            },
        ]
        const groups = groupEventsByOwner(events)
        const byId = Object.fromEntries(groups.map((g) => [g.id, g]))
        expect(byId["u1"].ownerName).toBe("Alice")
        expect(byId["u2"].ownerName).toBe("Bob")
        expect(byId["unassigned"].ownerName).toBe("Non assigné")
    })
})

describe("computeOverlapGroups", () => {
    test("regroupe les évènements qui se chevauchent", () => {
        const events: Event_creation[] = [
            {
                debut: "2026-05-26T09:00:00Z",
                fin: "2026-05-26T10:00:00Z",
                participants: null,
                lieu: null,
                description: null,
            },
            {
                debut: "2026-05-26T09:30:00Z",
                fin: "2026-05-26T10:30:00Z",
                participants: null,
                lieu: null,
                description: null,
            },
            {
                debut: "2026-05-26T11:00:00Z",
                fin: "2026-05-26T12:00:00Z",
                participants: null,
                lieu: null,
                description: null,
            },
        ]
        const groups = computeOverlapGroups(events)
        expect(groups).toHaveLength(2)
        expect(groups[0]).toHaveLength(2)
        expect(groups[1]).toHaveLength(1)
    })

    test("tableau vide en entrée renvoie tableau vide", () => {
        expect(computeOverlapGroups([])).toEqual([])
    })

    test("ignore les dates invalides", () => {
        const events: Event_creation[] = [
            {
                debut: "not-a-date",
                fin: "not-a-date",
                participants: null,
                lieu: null,
                description: null,
            },
        ]
        expect(computeOverlapGroups(events)).toEqual([])
    })
})
