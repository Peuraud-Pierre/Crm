import { expect, test } from "@rstest/core"
import {
    balleProbleme,
    checkHoraires,
    draftFromFiche,
    ecartDraft,
    isBlank,
    isEcart,
    newBalle,
    parsePoids,
    toBallesInput,
    totauxDraft,
    type BalleDraft,
} from "@/features/salle-de-tri/utils/triDraft"
import type { FicheTriComplete } from "@/features/salle-de-tri/types/tri.types"

const pleine = (over: Partial<BalleDraft> = {}): BalleDraft => ({
    ...newBalle(),
    fournisseur_id: "abc",
    category_id: "pantalon",
    poids: "100",
    qualite: 2,
    repartition: { MAG: "60", KS: "30", SO3: "10" },
    ...over,
})

test("poids : virgule française, deux décimales au plus, strictement positif", () => {
    expect(parsePoids("12,5")).toBe(12.5)
    expect(parsePoids(" 12.25 ")).toBe(12.25)
    expect(parsePoids("12,")).toBeNull()
    expect(parsePoids("12,345")).toBeNull()
    expect(parsePoids("0")).toBeNull()
    expect(parsePoids("-3")).toBeNull()
})

test("une nouvelle balle reprend fournisseur et catégorie de la précédente, rien d'autre", () => {
    const suivante = newBalle(pleine({ note: "x" }))
    expect(suivante).toMatchObject({ fournisseur_id: "abc", category_id: "pantalon", poids: "", qualite: null, note: "", repartition: {} })
    expect(suivante.key).not.toBe(newBalle().key)
})

test("écart = réparti − initial, au centième ; il n'existe pas sans poids initial", () => {
    expect(ecartDraft(pleine())).toBe(0)
    expect(ecartDraft(pleine({ repartition: { MAG: "60", KS: "30,5" } }))).toBe(-9.5)
    expect(ecartDraft(pleine({ repartition: { MAG: "60", KS: "45" } }))).toBe(5)
    // Un montant en cours de frappe compte 0, sans fausser le reste.
    expect(ecartDraft(pleine({ repartition: { MAG: "60", KS: "30", SO3: "10," } }))).toBe(-10)
    expect(ecartDraft(pleine({ poids: "" }))).toBeNull()
    expect(isEcart(0)).toBe(false)
    expect(isEcart(-0.01)).toBe(true)
    expect(isEcart(null)).toBe(false)
})

test("problèmes bloquants d'une balle commencée ; l'écart n'en est PAS un", () => {
    expect(balleProbleme(newBalle())).toBeNull()
    expect(isBlank(newBalle())).toBe(true)
    // Catégorie reprise mais rien saisi : pas vide, donc incomplète.
    expect(balleProbleme(newBalle(pleine()))).toBe("poids initial invalide")
    expect(balleProbleme(pleine({ fournisseur_id: "" }))).toBe("fournisseur manquant")
    expect(balleProbleme(pleine({ category_id: "" }))).toBe("catégorie manquante")
    expect(balleProbleme(pleine({ qualite: null }))).toBe("qualité manquante")
    expect(balleProbleme(pleine({ repartition: { MAG: "abc" } }))).toBe("répartition : un montant est illisible")
    expect(balleProbleme(pleine({ repartition: { MAG: "20" } }))).toBeNull()
    expect(balleProbleme(pleine({ repartition: {} }))).toBeNull()
})

test("conversion pour la RPC : balles vides écartées, parts vides retirées, problèmes numérotés", () => {
    const ok = toBallesInput([
        pleine({ note: "  humide " }),
        newBalle(),
        pleine({ poids: "50", qualite: 3, repartition: { MAG: "50", KS: "" } }),
    ])
    expect(ok).toEqual({
        ok: true,
        balles: [
            {
                fournisseur_id: "abc", category_id: "pantalon", poids_initial_kg: 100, qualite: 2, note: "humide",
                repartition: [{ sortie_id: "MAG", poids_kg: 60 }, { sortie_id: "KS", poids_kg: 30 }, { sortie_id: "SO3", poids_kg: 10 }],
            },
            { fournisseur_id: "abc", category_id: "pantalon", poids_initial_kg: 50, qualite: 3, note: null, repartition: [{ sortie_id: "MAG", poids_kg: 50 }] },
        ],
    })
    expect(toBallesInput([pleine(), pleine({ poids: "abc" })])).toEqual({ ok: false, problemes: ["Balle 2 : poids initial invalide"] })
    expect(toBallesInput([newBalle()])).toEqual({ ok: false, problemes: ["Saisissez au moins une balle."] })
})

test("totaux en direct : balles pleines, poids initial, réparti, balles en écart", () => {
    expect(totauxDraft([pleine(), pleine({ repartition: { MAG: "90" } }), newBalle()])).toEqual({
        balles: 2, initial: 200, reparti: 190, ecarts: 1,
    })
})

test("horaires : facultatifs mais entiers, la fin après le début", () => {
    expect(checkHoraires("", "")).toEqual({ ok: true, minutes: null })
    expect(checkHoraires("08:30", "11:00")).toEqual({ ok: true, minutes: 150 })
    expect(checkHoraires("08:30", "")).toEqual({ ok: false, probleme: "Heure de fin manquante" })
    expect(checkHoraires("", "11:00")).toEqual({ ok: false, probleme: "Heure de début manquante" })
    expect(checkHoraires("11:00", "11:00")).toEqual({ ok: false, probleme: "La fin doit suivre le début" })
})

test("modification : le brouillon reprend balles et répartition, poids à la française", () => {
    const fiche = {
        balles: [{
            id: "b1", fiche_id: "f1", ordre: 0, fournisseur_id: "abc", fournisseur_nom: "ABC", category_id: "pantalon", poids_initial_kg: 100.5, qualite: 2, note: null,
            poids_reparti_kg: 96, ecart_kg: -4.5, repartition: [{ sortie_id: "MAG", poids_kg: 60.25 }, { sortie_id: "KS", poids_kg: 35.75 }],
        }],
    } as unknown as FicheTriComplete
    const [b] = draftFromFiche(fiche)
    expect(b).toMatchObject({ fournisseur_id: "abc", category_id: "pantalon", poids: "100,5", qualite: 2, note: "", repartition: { MAG: "60,25", KS: "35,75" } })
})
