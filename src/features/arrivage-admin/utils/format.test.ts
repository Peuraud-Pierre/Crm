import { expect, test } from "@rstest/core"
import {
    formatBytes,
    formatDayLabel,
    formatDuration,
    formatPercent,
    shortId,
} from "@/features/arrivage-admin/utils/format"

// Les helpers de date ne sont pas testés ici : leur sortie dépend du fuseau de
// la machine, ce qui rendrait la suite instable en CI. Seul le formatage
// indépendant du fuseau est couvert.

test("formatDuration bascule d'unité selon l'ordre de grandeur", () => {
    expect(formatDuration(0)).toBe("0 ms")
    expect(formatDuration(320)).toBe("320 ms")
    expect(formatDuration(999)).toBe("999 ms")
    // Virgule décimale française, pas de point.
    expect(formatDuration(4200)).toBe("4,2 s")
    expect(formatDuration(59_900)).toBe("59,9 s")
    expect(formatDuration(192_000)).toBe("3 min 12 s")
})

test("formatDuration distingue l'absence de valeur du zéro", () => {
    // Un run encore en cours n'a pas de durée — il ne doit pas s'afficher
    // « 0 ms », qui se lirait comme un envoi instantané.
    expect(formatDuration(null)).toBe("—")
    expect(formatDuration(Number.NaN)).toBe("—")
    expect(formatDuration(0)).toBe("0 ms")
})

test("formatBytes bascule o / Ko / Mo", () => {
    expect(formatBytes(512)).toBe("512 o")
    expect(formatBytes(2048)).toBe("2 Ko")
    expect(formatBytes(3_145_728)).toBe("3,0 Mo")
})

test("formatBytes traite null et les tailles nulles comme inconnues", () => {
    expect(formatBytes(null)).toBe("—")
    expect(formatBytes(0)).toBe("—")
})

test("formatPercent rend un ratio 0..1 en pourcentage français", () => {
    expect(formatPercent(0)).toBe("0,0 %")
    expect(formatPercent(0.0512)).toBe("5,1 %")
    expect(formatPercent(1)).toBe("100,0 %")
})

test("formatDayLabel réduit une date ISO au jour et au mois", () => {
    expect(formatDayLabel("2026-08-17")).toBe("17/08")
    expect(formatDayLabel("2026-01-02")).toBe("02/01")
})

test("shortId tronque un uuid sans casser les chaînes courtes", () => {
    expect(shortId("3f2b1c4d-aaaa-bbbb-cccc-ddddeeeeffff")).toBe("3f2b1c4d…")
    expect(shortId("court")).toBe("court")
    expect(shortId(null)).toBe("—")
})
