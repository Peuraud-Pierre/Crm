import { expect, test } from "@rstest/core"
import {
    decouperEnCartons,
    ecartKg,
    formatKg,
    pourcentageRecu,
    recapCartons,
    resteAServir,
    segmentsAvancement,
    verdictReception,
} from "@/features/commandes/utils/commandeAvancement"
import type { AvancementLigne } from "@/features/commandes/types/commande.types"

/**
 * Les chiffres reprennent le scénario exécuté contre la migration
 * (`20261001110000_stock_commandes.sql`) : une commande de 100 kg de jeans
 * et 50 kg de pulls, servie en deux livraisons partielles dont la première
 * finit en litige.
 */

function ligne(over: Partial<AvancementLigne>): AvancementLigne {
    return {
        ligne_id: "l", commande_id: "c", category_id: "jean", category_nom: "Jean",
        kg_demande: 0, kg_prepare: 0, kg_expedie: 0, kg_recu: 0, kg_manquant: 0, kg_reste: 0,
        ...over,
    }
}

test("écart d'un carton : miroir de v_cartons.ecart_kg", () => {
    expect(ecartKg({ etat: "ecart_poids", poids_kg_prevu: 25, poids_kg_recu: 23 })).toBe(2)
    expect(ecartKg({ etat: "ecart_poids", poids_kg_prevu: 25, poids_kg_recu: 27.5 })).toBe(2.5)
    expect(ecartKg({ etat: "mauvaise_categorie", poids_kg_prevu: 20, poids_kg_recu: null })).toBe(20)
    expect(ecartKg({ etat: "manquant", poids_kg_prevu: 10, poids_kg_recu: null })).toBe(10)
    expect(ecartKg({ etat: "endommage", poids_kg_prevu: 10, poids_kg_recu: 10 })).toBe(10)
    expect(ecartKg({ etat: "conforme", poids_kg_prevu: 25, poids_kg_recu: 25.3 })).toBe(0)
    expect(ecartKg({ etat: null, poids_kg_prevu: 25, poids_kg_recu: null })).toBe(0)
})

test("verdict de réception : mêmes règles que receptionner_carton", () => {
    const base = { poidsPrevu: 25, poidsRecu: null, endommage: false, mauvaiseCategorie: false }
    // Sans pesée, le prévu fait foi.
    expect(verdictReception(base)).toBe("conforme")
    expect(verdictReception({ ...base, poidsRecu: 25.3 })).toBe("conforme") // 1,2 % : pesée
    expect(verdictReception({ ...base, poidsRecu: 23 })).toBe("ecart_poids")
    expect(verdictReception({ ...base, poidsRecu: 23, mauvaiseCategorie: true })).toBe("mauvaise_categorie")
    // Le dommage déclaré l'emporte sur tout le reste.
    expect(verdictReception({ ...base, mauvaiseCategorie: true, endommage: true })).toBe("endommage")
})

test("barre d'avancement après la première livraison (en litige)", () => {
    // HIVFKMMIXA001 : 100 demandés, 73,3 reçus, 26,7 à servir.
    const s = segmentsAvancement(ligne({ kg_demande: 100, kg_recu: 73.3, kg_reste: 26.7 }))
    expect(s.recu).toBeCloseTo(73.3)
    expect(s.reste).toBeCloseTo(26.7)
    // PERFKMVES003 : 50 demandés, 30 manquants (à renvoyer), 50 à servir.
    const m = segmentsAvancement(ligne({ kg_demande: 50, kg_manquant: 30, kg_reste: 50 }))
    expect(m.manquant).toBeCloseTo(60)
    expect(m.reste).toBeCloseTo(40)
    expect(m.recu + m.expedie + m.prepare + m.manquant + m.reste).toBeCloseTo(100)
})

test("une ligne servie au-delà du demandé ne déborde pas", () => {
    const s = segmentsAvancement(ligne({ kg_demande: 100, kg_recu: 102 }))
    expect(s.recu).toBe(100)
    expect(segmentsAvancement(ligne({}))).toEqual({ recu: 0, expedie: 0, prepare: 0, manquant: 0, reste: 0 })
})

test("pourcentage reçu, plafonné", () => {
    expect(pourcentageRecu({ kg_demande: 150, kg_recu: 75 })).toBe(50)
    expect(pourcentageRecu({ kg_demande: 100, kg_recu: 103 })).toBe(100)
    expect(pourcentageRecu({ kg_demande: 0, kg_recu: 0 })).toBe(0)
})

test("reste à servir : pré-remplissage de la livraison suivante", () => {
    expect(resteAServir([
        ligne({ category_id: "jean", category_nom: "Jean", kg_reste: 26.7 }),
        ligne({ category_id: "pull", category_nom: "Pull", kg_reste: 50 }),
        ligne({ category_id: "robe", category_nom: "Robe", kg_reste: 0 }),
    ])).toEqual([
        { category_id: "jean", category_nom: "Jean", kg: 26.7 },
        { category_id: "pull", category_nom: "Pull", kg: 50 },
    ])
})

test("découpe en cartons d'un poids type", () => {
    expect(decouperEnCartons(70, 25)).toEqual([25, 25, 20])
    expect(decouperEnCartons(50, 25)).toEqual([25, 25])
    expect(decouperEnCartons(51, 25)).toEqual([25, 26])  // 1 kg < 2,5 kg : rejoint le dernier
    expect(decouperEnCartons(12, 25)).toEqual([12])
    expect(decouperEnCartons(26.7, 25)).toEqual([26.7])
    expect(decouperEnCartons(0, 25)).toEqual([])
})

test("récapitulatif : kilos et part de chaque catégorie", () => {
    const r = recapCartons([
        { poids_kg_prevu: 20, category_id: "pull", category_nom: "Pull" },
        { poids_kg_prevu: 25, category_id: "jean", category_nom: "Jean" },
        { poids_kg_prevu: 25, category_id: "jean", category_nom: "Jean" },
    ])
    expect(r).toMatchObject({ cartons: 3, kg: 70 })
    expect(r.parCategorie.map((p) => `${p.nom}:${p.kg}:${p.cartons}`)).toEqual(["Jean:50:2", "Pull:20:1"])
})

test("kilos lisibles", () => {
    expect(formatKg(1250.56).replace(/\s/g, " ")).toBe("1 250,6 kg")
    expect(formatKg(25)).toBe("25 kg")
})
