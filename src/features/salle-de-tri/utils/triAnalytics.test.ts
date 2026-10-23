import { expect, test } from "@rstest/core"
import {
    applyTriFilters,
    compareTotals,
    computeTriAnalytics,
    countTriFilters,
    DEFAULT_TRI_FILTERS,
    formatDuree,
    formatEcart,
    formatHoraires,
    formatKg,
    fournisseursDe,
    isoWeekKey,
    kgParHeure,
    previousPeriod,
    qualitePonderee,
} from "@/features/salle-de-tri/utils/triAnalytics"
import type { FicheTriBalle, FicheTriComplete, Qualite } from "@/features/salle-de-tri/types/tri.types"

let seq = 0
const NOMS: Record<string, string> = { abc: "ABC", xyz: "XYZ" }

/** Balle : fournisseur, catégorie, poids initial, qualité, répartition `{ sortie: kg }`. */
function balle(fournisseur_id: string, category_id: string, initial: number, qualite: Qualite, parts: Record<string, number>, note: string | null = null): FicheTriBalle {
    seq++
    const repartition = Object.entries(parts).map(([sortie_id, poids_kg]) => ({ sortie_id, poids_kg }))
    const reparti = repartition.reduce((s, r) => s + r.poids_kg, 0)
    return {
        id: `b${seq}`, fiche_id: "", ordre: seq, fournisseur_id, fournisseur_nom: NOMS[fournisseur_id], category_id,
        poids_initial_kg: initial, qualite, note,
        poids_reparti_kg: reparti, ecart_kg: reparti - initial, repartition,
    }
}

function fiche(id: string, over: Partial<FicheTriComplete>, balles: FicheTriBalle[]): FicheTriComplete {
    return {
        id,
        numero: 1,
        code: `T-${id}`,
        date_tri: "2026-09-14",
        trieur_id: "karim",
        trieur_nom: "Karim",
        fournisseur_ids: [...new Set(balles.map((b) => b.fournisseur_id))],
        fournisseurs_noms: null,
        heure_debut: "08:00:00",
        heure_fin: "10:00:00",
        duree_minutes: 120,
        created_by: null,
        created_at: "",
        updated_at: "",
        poids_initial_kg: 0,
        poids_reparti_kg: 0,
        ecart_kg: 0,
        nb_balles: balles.length,
        nb_balles_ecart: 0,
        qualite_moyenne: null,
        balles: balles.map((b) => ({ ...b, fiche_id: id })),
        ...over,
    }
}

// Karim : 60 kg en 2 h ; Lina : 40 kg en 1 h ; une fiche sans horaires (20 kg).
// Une seule balle en écart : la veste de Lina (30 kg, 26 répartis).
// La fiche de Lina mêle deux fournisseurs : le fournisseur est celui de la BALLE.
const FICHES = [
    fiche("1", {}, [balle("abc", "jean", 60, 3, { MAG: 38, EXPORT: 22 })]),
    fiche("2", { trieur_id: "lina", trieur_nom: "Lina", duree_minutes: 60, date_tri: "2026-09-21" },
        [balle("xyz", "veste", 30, 2, { KS: 26 }, "boutons abîmés"), balle("abc", "jean", 10, 3, { MAG: 10 })]),
    fiche("3", { duree_minutes: null, heure_debut: null, heure_fin: null },
        [balle("xyz", "veste", 20, 1, { MAG: 20 })]),
]

test("qualité pondérée par le poids initial des balles", () => {
    expect(qualitePonderee([balle("abc", "a", 60, 3, {}), balle("abc", "a", 20, 1, {})])).toBeCloseTo(200 / 80)
    expect(qualitePonderee([])).toBeNull()
})

test("kg/h sur le poids initial : une fiche sans horaires ne compte ni au numérateur ni au dénominateur", () => {
    expect(kgParHeure(FICHES)).toBeCloseTo(100 / 3)
    expect(kgParHeure([FICHES[2]])).toBeNull()
})

test("totaux : kilos triés (initial) ≠ kilos répartis, écarts comptés", () => {
    const a = computeTriAnalytics(FICHES)
    expect(a.totals.kg).toBe(120)
    expect(a.totals.reparti).toBe(116)
    expect(a.totals.fiches).toBe(3)
    expect(a.totals.balles).toBe(4)
    expect(a.totals.minutes).toBe(180)
    expect(a.totals.ecarts).toEqual({ balles: 1, kg: -4 })
    expect(a.parSortie[0]).toEqual({ sortieId: "MAG", kg: 68, pct: (68 / 116) * 100 })
})

test("par trieur : kilos triés, fiches, balles, productivité, écarts", () => {
    const [karim, lina] = computeTriAnalytics(FICHES).parTrieur
    expect(karim).toMatchObject({ id: "karim", kg: 80, fiches: 2, balles: 2, kgParHeure: 30, ecarts: 0 })
    expect(lina).toMatchObject({ id: "lina", kg: 40, fiches: 1, balles: 2, kgParHeure: 40, ecarts: 1 })
})

test("par fournisseur : balle par balle, sans kg/h — une fiche en mêle plusieurs", () => {
    const [abc, xyz] = computeTriAnalytics(FICHES).parFournisseur
    expect(abc).toMatchObject({ id: "abc", kg: 70, balles: 2, fiches: 2, kgParHeure: null, ecarts: 0 })
    expect(xyz).toMatchObject({ id: "xyz", kg: 50, balles: 2, fiches: 2, kgParHeure: null, ecarts: 1 })
    expect(xyz.qualite).toBeCloseTo((30 * 2 + 20 * 1) / 50)
})

test("par semaine ISO et par catégorie × type, lus dans la répartition", () => {
    const a = computeTriAnalytics(FICHES)
    expect(a.parSemaine.map((w) => w.semaine)).toEqual(["2026-W38", "2026-W39"])
    expect(a.parSemaine[0]).toMatchObject({ MAG: 58, EXPORT: 22 })
    expect(a.parCategorie[0]).toMatchObject({ categoryId: "jean", kg: 70, balles: 2, bySortie: { MAG: 48, EXPORT: 22 } })
})

test("filtres d'en-tête : trieur, période, fiches en écart", () => {
    expect(applyTriFilters(FICHES, { ...DEFAULT_TRI_FILTERS, trieurId: "lina" }).map((f) => f.id)).toEqual(["2"])
    expect(applyTriFilters(FICHES, { ...DEFAULT_TRI_FILTERS, dateFrom: "2026-09-15" }).map((f) => f.id)).toEqual(["2"])
    expect(applyTriFilters(FICHES, { ...DEFAULT_TRI_FILTERS, dateTo: "2026-09-14" }).map((f) => f.id)).toEqual(["1", "3"])
    // La fiche entière reste : ses balles sans écart comprises.
    const enEcart = applyTriFilters(FICHES, { ...DEFAULT_TRI_FILTERS, ecartsSeuls: true })
    expect(enEcart.map((f) => f.id)).toEqual(["2"])
    expect(enEcart[0].balles).toHaveLength(2)
})

test("filtre fournisseur : au niveau de la balle", () => {
    const xyz = applyTriFilters(FICHES, { ...DEFAULT_TRI_FILTERS, fournisseurId: "xyz" })
    expect(xyz.map((f) => f.id)).toEqual(["2", "3"])
    expect(xyz[0].balles.map((b) => b.category_id)).toEqual(["veste"])
    expect(fournisseursDe(xyz[0])).toBe("XYZ")
    expect(fournisseursDe(FICHES[1])).toBe("ABC, XYZ")
})

test("filtres de balle : catégorie et qualité gardent des balles, un type n'en garde que la part", () => {
    const jeanMag = applyTriFilters(FICHES, { ...DEFAULT_TRI_FILTERS, categoryId: "jean", sortieId: "MAG" })
    expect(jeanMag.map((f) => f.id)).toEqual(["1", "2"])
    const a = computeTriAnalytics(jeanMag)
    expect(a.totals.reparti).toBe(48)
    expect(a.parSortie.map((p) => p.sortieId)).toEqual(["MAG"])
    const best = applyTriFilters(FICHES, { ...DEFAULT_TRI_FILTERS, qualiteMin: 3 })
    expect(computeTriAnalytics(best).totals.kg).toBe(70)
})

test("recherche libre : code, trieur, fournisseur, catégorie, note de balle", () => {
    const names = (id: string) => ({ jean: "Jean homme", veste: "Veste cuir" })[id] ?? ""
    expect(applyTriFilters(FICHES, { ...DEFAULT_TRI_FILTERS, search: "lina" }, names).map((f) => f.id)).toEqual(["2"])
    expect(applyTriFilters(FICHES, { ...DEFAULT_TRI_FILTERS, search: "boutons" }, names).map((f) => f.id)).toEqual(["2"])
    expect(applyTriFilters(FICHES, { ...DEFAULT_TRI_FILTERS, search: "veste cuir" }, names).map((f) => f.id)).toEqual(["2", "3"])
    expect(applyTriFilters(FICHES, { ...DEFAULT_TRI_FILTERS, search: "xyz" }, names).map((f) => f.id)).toEqual(["2", "3"])
})

test("compte des filtres actifs (la recherche n'en est pas un)", () => {
    expect(countTriFilters(DEFAULT_TRI_FILTERS)).toBe(0)
    expect(countTriFilters({ ...DEFAULT_TRI_FILTERS, search: "x", dateFrom: "2026-01-01", dateTo: "2026-02-01", qualiteMin: 2 })).toBe(2)
    expect(countTriFilters({ ...DEFAULT_TRI_FILTERS, ecartsSeuls: true })).toBe(1)
})

test("période vide", () => {
    const a = computeTriAnalytics([])
    expect(a.totals).toEqual({ kg: 0, reparti: 0, fiches: 0, balles: 0, minutes: 0, kgParHeure: null, qualite: null, ecarts: { balles: 0, kg: 0 } })
    expect(a.parSemaine).toEqual([])
})

test("semaine ISO en bord d'année", () => {
    expect(isoWeekKey("2026-01-01")).toBe("2026-W01")
    expect(isoWeekKey("2027-01-01")).toBe("2026-W53")
})

test("affichage : durée, horaires, kilos, écart signé", () => {
    expect(formatDuree(150)).toBe("2 h 30")
    expect(formatDuree(120)).toBe("2 h")
    expect(formatDuree(45)).toBe("45 min")
    expect(formatDuree(null)).toBe("—")
    expect(formatHoraires("08:30:00", "11:00:00")).toBe("08:30 → 11:00")
    expect(formatHoraires(null, null)).toBeNull()
    expect(formatKg(38)).toMatch(/^38\skg$/)
    expect(formatKg(12_400)).toMatch(/^12,4\st$/)
    expect(formatEcart(-4)).toMatch(/^−4\skg$/)
    expect(formatEcart(2.5)).toMatch(/^\+2,5\skg$/)
})

test("période précédente : même durée, juste avant", () => {
    expect(previousPeriod({ dateFrom: "2026-09-01", dateTo: "2026-09-30" })).toEqual({ from: "2026-08-02", to: "2026-08-31" })
    // Fin vide = aujourd'hui.
    expect(previousPeriod({ dateFrom: "2026-09-25", dateTo: "" }, new Date("2026-10-01T12:00:00"))).toEqual({ from: "2026-09-18", to: "2026-09-24" })
    // « Tout » : rien avant.
    expect(previousPeriod({ dateFrom: "", dateTo: "" })).toBeNull()
})

test("tendance : relative pour les kilos, absolue pour qualité et écarts", () => {
    const prev = computeTriAnalytics([fiche("p", {}, [balle("abc", "jean", 100, 2, { mag: 100 })])]).totals
    const cur = computeTriAnalytics([fiche("c", {}, [balle("abc", "jean", 150, 3, { mag: 140 })])]).totals
    const t = compareTotals(prev, cur)
    expect(t.kg).toBeCloseTo(0.5)
    expect(t.kgParHeure).toBeCloseTo(0.5)
    expect(t.qualite).toBe(1)
    expect(t.ecarts).toBe(1)
    // Rien à comparer quand la période précédente est vide.
    expect(compareTotals(computeTriAnalytics([]).totals, cur)).toEqual({ kg: null, kgParHeure: null, qualite: null, ecarts: null })
})
