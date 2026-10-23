/**
 * Garde-fou d'alignement front ↔ newsletter.
 *
 * Le classeur des arrivages est produit par deux moteurs distincts — cet export
 * manuel et `GenerateForSubscriber` (newsletter-console/internal/excel/generator.go) —
 * qui sont censés être indiscernables. Les valeurs attendues ci-dessous sont
 * relevées sur la sortie du générateur Go pour le même jeu de lignes
 * (voir TestScheduledRowLightsUpDateColumns et voisins). Si ce test casse, l'une
 * des deux sorties a dérivé : corriger les deux, pas seulement l'attendu.
 */
import { expect, test } from "@rstest/core"
import type { ArrivageManuelRow } from "@/features/stock/types/arrivage-manuel.types"
import { fmtDate, fmtDatetime, groupByMonth, monthBannerLabel } from "@/features/stock/utils/arrivageGrouping"
import { rowStateOf } from "@/features/stock/utils/buildArrivageWorkbook"

const NOW = new Date("2026-08-15T08:00:00.000Z")

function row(o: Partial<ArrivageManuelRow>): ArrivageManuelRow {
    return {
        id: o.container_no!, container_no: o.container_no!, conteneur_no_raw: null,
        fournisseur_id: null, status: "planifié", status_auto: false, transport_mode: null,
        departure_date: null, port_arrival_date: null, total_weight_kg: null, total_qty: null,
        prev_dechargement_at: null, notes: null, invoice_date: null,
        created_at: "2026-07-01T08:00:00.000Z", updated_at: "2026-07-01T08:00:00.000Z", ...o,
    }
}

const rows = [
    row({ container_no: "ROUTE", invoice_date: "2026-07-10", departure_date: "2026-08-01", port_arrival_date: "2026-08-20", prev_dechargement_at: "2026-08-25T08:00:00.000Z" }),
    row({ container_no: "PASSE", status: "reçu", invoice_date: "2026-07-10", departure_date: "2026-07-01", prev_dechargement_at: "2026-08-05T08:00:00.000Z" }),
    row({ container_no: "ALERT", departure_date: "2026-08-02", prev_dechargement_at: "2026-08-18T08:00:00.000Z" }),
    row({ container_no: "NEUTRE", invoice_date: "2026-07-10", departure_date: "2026-08-03", port_arrival_date: "2026-08-28" }),
    row({ container_no: "MINUIT", invoice_date: "2026-07-10", prev_dechargement_at: "2026-08-31T23:00:00.000Z" }),
]

test("le front calcule exactement les mêmes états que le générateur Go", () => {
    const groups = groupByMonth(rows, NOW)
    const actual = {
        etats: Object.fromEntries(rows.map(r => [r.container_no, {
            state: rowStateOf(r, NOW),
            dech: fmtDatetime(r.prev_dechargement_at),
            depart: fmtDate(r.departure_date),
        }])),
        banners: groups.map(monthBannerLabel),
        order: groups.flatMap(g => g.rows.map(r => r.container_no)),
    }

    // Valeurs relevées sur la sortie du générateur Go pour le même jeu de lignes.
    expect(actual).toEqual({
        etats: {
            ROUTE:  { state: "scheduled", dech: "Mardi 25/08/26 · 10:00",    depart: "01/08/26" },
            PASSE:  { state: "past",      dech: "Mercredi 05/08/26 · 10:00", depart: "01/07/26" },
            ALERT:  { state: "alert",     dech: "Mardi 18/08/26 · 10:00",    depart: "02/08/26" },
            NEUTRE: { state: "normal",    dech: "",                          depart: "03/08/26" },
            MINUIT: { state: "scheduled", dech: "Mardi 01/09/26 · 01:00",    depart: "" },
        },
        banners: [
            "SEPTEMBRE 2026 · 1 arrivage · 1 à venir",
            "AOÛT 2026 · 4 arrivages · 3 à venir",
        ],
        order: ["MINUIT", "NEUTRE", "ROUTE", "ALERT", "PASSE"],
    })
})
