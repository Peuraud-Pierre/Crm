import { expect, test } from "@rstest/core"
import { normalizeUrgency, URGENCY_ORDER } from "./normalize"

// Le formulaire du site est bilingue : chaque niveau arrive sous deux libellés
// qui doivent se replier sur une seule barre du graphique.
test("normalizeUrgency : FR et EN se replient sur le même libellé", () => {
    expect(normalizeUrgency("Besoin immédiat")).toBe("Besoin immédiat")
    expect(normalizeUrgency("Immediate need")).toBe("Besoin immédiat")

    expect(normalizeUrgency("D'ici 1 semaine")).toBe("D'ici 1 semaine")
    expect(normalizeUrgency("Within 1 week")).toBe("D'ici 1 semaine")

    expect(normalizeUrgency("D'ici la fin du mois")).toBe("D'ici la fin du mois")
    expect(normalizeUrgency("By the end of the month")).toBe("D'ici la fin du mois")

    expect(normalizeUrgency("Sans urgence")).toBe("Sans urgence")
    expect(normalizeUrgency("No urgency")).toBe("Sans urgence")
})

test("normalizeUrgency : vide et absent donnent « Inconnu »", () => {
    expect(normalizeUrgency(null)).toBe("Inconnu")
    expect(normalizeUrgency("")).toBe("Inconnu")
    expect(normalizeUrgency("   ")).toBe("Inconnu")
})

// Casse et espaces insécables : un champ de formulaire ne les garantit pas.
test("normalizeUrgency : insensible à la casse et aux espaces", () => {
    expect(normalizeUrgency("  BESOIN IMMÉDIAT  ")).toBe("Besoin immédiat")
    expect(normalizeUrgency("within 1 WEEK")).toBe("D'ici 1 semaine")
})

// Une valeur inattendue doit rester lisible plutôt que d'être écrasée.
test("normalizeUrgency : valeur hors registre conservée telle quelle", () => {
    expect(normalizeUrgency("Dans 2 ans")).toBe("Dans 2 ans")
})

// L'ordre sert à trier le graphique : tout libellé produit doit y figurer,
// sinon il serait relégué en fin de liste sans qu'on s'en aperçoive.
test("URGENCY_ORDER couvre tous les libellés produits", () => {
    const produits = [
        "Besoin immédiat", "Immediate need",
        "D'ici 1 semaine", "Within 1 week",
        "D'ici la fin du mois", "By the end of the month",
        "Sans urgence", "No urgency",
        null,
    ].map((v) => normalizeUrgency(v))

    for (const libelle of new Set(produits)) {
        expect(URGENCY_ORDER).toContain(libelle)
    }
})
