import { expect, test } from "@rstest/core"
import {
    computeFournisseurAnalytics,
    formatTonnage,
    inactiveFournisseurs,
} from "@/features/stock/utils/fournisseurAnalytics"
import type { ArrivageManuelRow } from "@/features/stock/types/arrivage-manuel.types"
import type { Fournisseur } from "@/features/stock/types/stock.types"

const NOW = new Date("2026-08-18T12:00:00.000Z")

const FOURNISSEURS: Fournisseur[] = [
    { id: "f1", name: "Ali Textile",  siege_localisation: "Izmir", tag: "ALI", created_at: "2026-01-01" },
    { id: "f2", name: "Bora Export",  siege_localisation: "Lyon",  tag: "BOR", created_at: "2026-01-01" },
    { id: "f3", name: "Dormant SARL", siege_localisation: "",      tag: "",    created_at: "2026-01-01" },
]

function makeRow(overrides: Partial<ArrivageManuelRow> = {}): ArrivageManuelRow {
    return {
        id: "a1",
        container_no: "ABCD1234567",
        conteneur_no_raw: null,
        fournisseur_id: "f1",
        status: "reçu",
        status_auto: false,
        transport_mode: "40'",
        departure_date: null,
        port_arrival_date: null,
        total_weight_kg: 1000,
        total_qty: 10,
        prev_dechargement_at: "2026-08-10T08:00:00.000Z",
        notes: null,
        invoice_date: null,
        created_at: "2026-08-01T08:00:00.000Z",
        updated_at: "2026-08-01T08:00:00.000Z",
        ...overrides,
    }
}

const FULL_RANGE = { from: "", to: "" }

test("agrège les arrivages par fournisseur et calcule les parts", () => {
    const rows = [
        makeRow({ id: "a1", fournisseur_id: "f1" }),
        makeRow({ id: "a2", fournisseur_id: "f1", total_weight_kg: 500, total_qty: 5 }),
        makeRow({ id: "a3", fournisseur_id: "f2", total_weight_kg: 2000, total_qty: 20 }),
    ]

    const { totals, perFournisseur } = computeFournisseurAnalytics(
        rows, FOURNISSEURS, FULL_RANGE, NOW,
    )

    expect(totals.arrivages).toBe(3)
    expect(totals.weightKg).toBe(3500)
    expect(totals.qty).toBe(35)
    expect(totals.activeFournisseurs).toBe(2)

    // Tri décroissant sur le nombre d'arrivages
    expect(perFournisseur[0].name).toBe("Ali Textile")
    expect(perFournisseur[0].arrivageCount).toBe(2)
    expect(perFournisseur[0].sharePct).toBeCloseTo(66.67, 1)
    expect(perFournisseur[1].arrivageCount).toBe(1)
})

test("période vide : aucun arrivage compté, aucune division par zéro", () => {
    const rows = [makeRow()]

    const { totals, perFournisseur, statusBreakdown } = computeFournisseurAnalytics(
        rows, FOURNISSEURS, { from: "2020-01-01", to: "2020-12-31" }, NOW,
    )

    expect(totals.arrivages).toBe(0)
    expect(totals.activeFournisseurs).toBe(0)
    expect(statusBreakdown).toHaveLength(0)
    for (const entry of perFournisseur) expect(entry.sharePct).toBe(0)
})

test("bornes de période inclusives sur la journée", () => {
    const rows = [makeRow({ prev_dechargement_at: "2026-08-10T23:30:00.000Z" })]

    const inside = computeFournisseurAnalytics(
        rows, FOURNISSEURS, { from: "2026-08-10", to: "2026-08-10" }, NOW,
    )
    expect(inside.totals.arrivages).toBe(1)

    const outside = computeFournisseurAnalytics(
        rows, FOURNISSEURS, { from: "2026-08-11", to: "" }, NOW,
    )
    expect(outside.totals.arrivages).toBe(0)
})

test("poids et quantité nuls comptent pour zéro, pas NaN", () => {
    const rows = [makeRow({ total_weight_kg: null, total_qty: null })]

    const { totals } = computeFournisseurAnalytics(rows, FOURNISSEURS, FULL_RANGE, NOW)

    expect(totals.weightKg).toBe(0)
    expect(totals.qty).toBe(0)
    expect(totals.arrivages).toBe(1)
})

test("arrivage sans fournisseur est ignoré", () => {
    const rows = [makeRow({ fournisseur_id: null })]

    const { totals, perFournisseur } = computeFournisseurAnalytics(
        rows, FOURNISSEURS, FULL_RANGE, NOW,
    )

    expect(totals.arrivages).toBe(0)
    expect(perFournisseur).toHaveLength(FOURNISSEURS.length)
})

test("un fournisseur sans arrivage apparaît avec des compteurs à zéro", () => {
    const { perFournisseur } = computeFournisseurAnalytics(
        [makeRow()], FOURNISSEURS, FULL_RANGE, NOW,
    )

    const dormant = perFournisseur.find((entry) => entry.fournisseur_id === "f3")
    expect(dormant?.arrivageCount).toBe(0)
    expect(dormant?.lastArrivageAt).toBeNull()
})

test("la fraîcheur ignore le filtre de période", () => {
    // Arrivage récent mais hors de la fenêtre affichée : le fournisseur ne doit
    // pas basculer en dormant pour autant.
    const rows = [makeRow({ prev_dechargement_at: "2026-08-15T08:00:00.000Z" })]

    const { perFournisseur, totals } = computeFournisseurAnalytics(
        rows, FOURNISSEURS, { from: "2026-01-01", to: "2026-01-31" }, NOW,
    )

    expect(totals.arrivages).toBe(0)
    const ali = perFournisseur.find((entry) => entry.fournisseur_id === "f1")
    expect(ali?.lastArrivageAt).toBe("2026-08-15T08:00:00.000Z")
    // f2 et f3 n'ont jamais d'arrivage → dormants ; f1 non.
    expect(totals.inactiveFournisseurs).toBe(2)
})

test("inactiveFournisseurs liste les jamais-vus d'abord", () => {
    const rows = [
        makeRow({ id: "a1", fournisseur_id: "f1", prev_dechargement_at: "2026-08-15T08:00:00.000Z" }),
        makeRow({ id: "a2", fournisseur_id: "f2", prev_dechargement_at: "2025-01-15T08:00:00.000Z" }),
    ]

    const { perFournisseur } = computeFournisseurAnalytics(rows, FOURNISSEURS, FULL_RANGE, NOW)
    const dormant = inactiveFournisseurs(perFournisseur, NOW)

    expect(dormant.map((entry) => entry.fournisseur_id)).toEqual(["f3", "f2"])
})

test("statusBreakdown ne retient que les statuts présents", () => {
    const rows = [
        makeRow({ id: "a1", status: "reçu" }),
        makeRow({ id: "a2", status: "en_transit" }),
        makeRow({ id: "a3", status: "en_transit" }),
    ]

    const { statusBreakdown } = computeFournisseurAnalytics(rows, FOURNISSEURS, FULL_RANGE, NOW)

    expect(statusBreakdown).toEqual([
        { status: "en_transit", count: 2 },
        { status: "reçu", count: 1 },
    ])
})

test("un fournisseur tout juste créé n'est pas compté dormant", () => {
    const fresh: Fournisseur[] = [
        { id: "f9", name: "Nouveau", siege_localisation: "", tag: "", created_at: "2026-08-17T09:00:00.000Z" },
    ]

    const { totals } = computeFournisseurAnalytics([], fresh, FULL_RANGE, NOW)
    expect(totals.inactiveFournisseurs).toBe(0)

    const { perFournisseur } = computeFournisseurAnalytics([], fresh, FULL_RANGE, NOW)
    expect(inactiveFournisseurs(perFournisseur, NOW)).toHaveLength(0)
})

test("un arrivage référençant un fournisseur supprimé ne gonfle pas les actifs", () => {
    // `arrivage_manuel.fournisseur_id` n'a pas de clé étrangère : des id
    // orphelins existent dès qu'un fournisseur est supprimé.
    const rows = [makeRow({ fournisseur_id: "disparu" })]

    const { totals, perFournisseur } = computeFournisseurAnalytics(
        rows, FOURNISSEURS, FULL_RANGE, NOW,
    )

    expect(totals.arrivages).toBe(1)
    expect(totals.activeFournisseurs).toBe(0)
    expect(totals.activeFournisseurs).toBeLessThanOrEqual(FOURNISSEURS.length)

    const orphan = perFournisseur.find((entry) => entry.fournisseur_id === "disparu")
    expect(orphan?.name).toBe("Fournisseur inconnu")
    // Un orphelin n'est pas « à nettoyer » : il n'existe plus au référentiel.
    expect(inactiveFournisseurs(perFournisseur, NOW).map((e) => e.fournisseur_id))
        .not.toContain("disparu")
})

test("formatTonnage bascule des kg aux tonnes", () => {
    expect(formatTonnage(0)).toBe("0 kg")
    expect(formatTonnage(999)).toBe("999 kg")
    expect(formatTonnage(12_480)).toBe("12,5 t")
})
