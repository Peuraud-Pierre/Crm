import { expect, test } from "@rstest/core"
import type { Client } from "@/features/crm/types"
import { resolveSingletonEventClient } from "./eventModal"

const mk = (id: string): Client => ({ id }) as unknown as Client

const clients = [mk("a"), mk("b"), mk("c")]

test("retourne undefined quand aucune modale n'est demandée", () => {
    expect(resolveSingletonEventClient(null, clients, false, undefined)).toBe(
        undefined
    )
})

test("anti-doublon : fiche ouverte pour le même client → undefined", () => {
    // La fiche rend déjà sa propre modale pour ce client.
    expect(resolveSingletonEventClient("b", clients, true, "b")).toBe(undefined)
})

test("fiche ouverte pour un AUTRE client → le singleton gère openEventModal", () => {
    expect(resolveSingletonEventClient("b", clients, true, "a")).toBe(
        clients[1]
    )
})

test("fiche fermée → le singleton retrouve le client par id", () => {
    expect(resolveSingletonEventClient("c", clients, false, undefined)).toBe(
        clients[2]
    )
})

test("id introuvable dans clients → undefined", () => {
    expect(
        resolveSingletonEventClient("zzz", clients, false, undefined)
    ).toBe(undefined)
})
