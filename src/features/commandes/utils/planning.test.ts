import { expect, test } from "@rstest/core"
import {
    buildPlanningRows,
    isEnRetard,
    livraisonPlanningDay,
    planningDays,
    planningKpis,
    prochainLundi,
    shiftAnchor,
} from "@/features/commandes/utils/planning"
import type { CommandeBoutique, LivraisonBoutique } from "@/features/commandes/types/commande.types"

const TODAY = "2026-10-07" // un mercredi

function livraison(over: Partial<LivraisonBoutique>): LivraisonBoutique {
    return {
        id: "l", numero: 1, code: "LIV-0001", commande_id: null, commande_code: null,
        boutique_id: "lyo", boutique_nom: "Lyon", boutique_code: "LYO", statut: "planifiee",
        date_preparation_prevue: null, date_expedition_prevue: null, date_livraison_prevue: null,
        expediee_at: null, expediee_par: null, receptionnee_at: null, note: null, created_by: null,
        created_at: "", updated_at: "", nb_palettes: 0, nb_cartons: 0, nb_recus: 0, nb_ecarts: 0,
        kg_prevu: 0, kg_recu: 0, kg_ecart: 0,
        ...over,
    }
}

function commande(over: Partial<CommandeBoutique>): CommandeBoutique {
    return {
        id: "c", numero: 1, code: "CMD-0001", boutique_id: "lyo", boutique_nom: "Lyon", boutique_code: "LYO",
        date_souhaitee: null, statut: "ouverte", motif_cloture: null, note: null, created_by: null,
        created_at: "", updated_at: "", kg_demande: 0, kg_prepare: 0, kg_expedie: 0, kg_recu: 0, kg_reste: 0,
        nb_lignes: 0, nb_livraisons: 0, derniere_livraison_at: null,
        ...over,
    }
}

test("semaine du lundi au dimanche, mois complet", () => {
    const week = planningDays(new Date(`${TODAY}T12:00:00`), "semaine")
    expect(week[0]).toBe("2026-10-05")
    expect(week[6]).toBe("2026-10-11")
    const month = planningDays(new Date(`${TODAY}T12:00:00`), "mois")
    expect(month).toHaveLength(31)
    expect(month[0]).toBe("2026-10-01")
    expect(shiftAnchor(new Date(`${TODAY}T12:00:00`), "semaine", -1).getDate()).toBe(30)
})

test("placement : la date réelle d'expédition l'emporte sur la prévue", () => {
    expect(livraisonPlanningDay(livraison({ date_expedition_prevue: "2026-10-05" }))).toBe("2026-10-05")
    expect(livraisonPlanningDay(livraison({ date_expedition_prevue: "2026-10-05", expediee_at: "2026-10-06T09:30:00" }))).toBe("2026-10-06")
    expect(livraisonPlanningDay(livraison({ date_preparation_prevue: "2026-10-02" }))).toBe("2026-10-02")
    expect(livraisonPlanningDay(livraison({}))).toBeNull()
})

test("retard : selon l'étape en cours", () => {
    expect(isEnRetard(livraison({ statut: "preparation", date_expedition_prevue: "2026-10-06" }), TODAY)).toBe(true)
    expect(isEnRetard(livraison({ statut: "preparation", date_expedition_prevue: TODAY }), TODAY)).toBe(false)
    expect(isEnRetard(livraison({ statut: "expediee", date_expedition_prevue: "2026-10-01", date_livraison_prevue: "2026-10-09" }), TODAY)).toBe(false)
    expect(isEnRetard(livraison({ statut: "en_reception", date_livraison_prevue: "2026-10-06" }), TODAY)).toBe(true)
    expect(isEnRetard(livraison({ statut: "litige", date_livraison_prevue: "2026-10-01" }), TODAY)).toBe(false)
})

test("lignes du planning : boutiques actives même vides, livraisons et échéances placées", () => {
    const days = planningDays(new Date(`${TODAY}T12:00:00`), "semaine")
    const rows = buildPlanningRows(
        [{ id: "par", nom: "Paris", actif: true }, { id: "lyo", nom: "Lyon", actif: true }, { id: "old", nom: "Fermée", actif: false }],
        [
            livraison({ id: "a", date_expedition_prevue: "2026-10-06" }),
            livraison({ id: "b", date_expedition_prevue: "2026-10-06" }),
            livraison({ id: "hors", date_expedition_prevue: "2026-11-01" }),
            livraison({ id: "annulee", statut: "annulee", date_expedition_prevue: "2026-10-06" }),
        ],
        [commande({ date_souhaitee: "2026-10-09" }), commande({ id: "s", statut: "soldee", date_souhaitee: "2026-10-09" })],
        days,
    )
    expect(rows.map((r) => r.boutiqueNom)).toEqual(["Lyon", "Paris"])
    expect(rows[0].livraisons.get("2026-10-06")?.map((l) => l.id)).toEqual(["a", "b"])
    expect(rows[0].echeances.get("2026-10-09")).toHaveLength(1)
    expect(rows[1].livraisons.size).toBe(0)
})

test("bandeau de supervision", () => {
    const k = planningKpis(
        [
            livraison({ statut: "preparation", date_expedition_prevue: "2026-10-06" }),
            livraison({ statut: "litige", expediee_at: "2026-09-28T08:00:00", kg_ecart: 62 }),
            livraison({ statut: "receptionnee", expediee_at: "2026-10-05T08:00:00", kg_ecart: 0 }),
        ],
        [commande({ statut: "en_cours" }), commande({ statut: "ouverte" }), commande({ statut: "soldee" })],
        TODAY,
    )
    expect(k).toEqual({ commandesOuvertes: 2, livraisonsSemaine: 2, enRetard: 1, enLitige: 1, kgEcart: 62 })
})

test("prochain lundi", () => {
    expect(prochainLundi(new Date(`${TODAY}T12:00:00`))).toBe("2026-10-12")
})
