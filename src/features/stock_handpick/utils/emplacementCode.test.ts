import { expect, test } from "@rstest/core"
import {
    emplacementCodeUrl,
    emplacementOfPlanDetail,
    findEmplacementByPath,
    parseEmplacementCode,
    planDetailOfEmplacement,
} from "./emplacementCode"

/**
 * Étiquettes QR : le code porte l'URL de l'emplacement dans l'app, pour que
 * l'appareil photo natif l'ouvre directement ; le lecteur intégré en extrait
 * l'id.
 */

const ID = "3f2b8c1e-9a4d-4e21-b7c5-0d6e8f9a1b2c"

test("l'URL d'un code pointe vers l'onglet Codes", () => {
    expect(emplacementCodeUrl("https://app.example.fr", ID)).toBe(
        `https://app.example.fr/stock-handpick/codes/${ID}`,
    )
    // Slash final de l'origin toléré.
    expect(emplacementCodeUrl("https://app.example.fr/", ID)).toBe(
        `https://app.example.fr/stock-handpick/codes/${ID}`,
    )
})

test("l'id est retrouvé quel que soit l'environnement qui a imprimé le code", () => {
    expect(parseEmplacementCode(`https://app.example.fr/stock-handpick/codes/${ID}`)).toBe(ID)
    expect(parseEmplacementCode(`http://localhost:3000/stock-handpick/codes/${ID}`)).toBe(ID)
    expect(parseEmplacementCode(`https://preprod.example.fr/stock-handpick/codes/${ID.toUpperCase()}`)).toBe(ID)
})

test("slash final, query string et fragment ne gênent pas", () => {
    expect(parseEmplacementCode(`https://a.fr/stock-handpick/codes/${ID}/`)).toBe(ID)
    expect(parseEmplacementCode(`https://a.fr/stock-handpick/codes/${ID}?src=qr#top`)).toBe(ID)
    expect(parseEmplacementCode(`  https://a.fr/stock-handpick/codes/${ID}\n`)).toBe(ID)
})

test("un uuid nu est accepté (saisie manuelle)", () => {
    expect(parseEmplacementCode(ID)).toBe(ID)
})

test("tout autre texte est refusé", () => {
    expect(parseEmplacementCode("")).toBeNull()
    expect(parseEmplacementCode("bonjour")).toBeNull()
    expect(parseEmplacementCode("https://a.fr/stock-handpick/inventaire/" + ID)).toBeNull()
    expect(parseEmplacementCode("https://a.fr/stock-handpick/codes/pas-un-uuid")).toBeNull()
    expect(parseEmplacementCode("3760123456789")).toBeNull()
})

test("le détail du plan distingue un emplacement d'une balle", () => {
    expect(planDetailOfEmplacement(ID)).toBe(`emp-${ID}`)
    expect(emplacementOfPlanDetail(`emp-${ID}`)).toBe(ID)
    expect(emplacementOfPlanDetail(ID)).toBeNull()
    expect(emplacementOfPlanDetail(undefined)).toBeNull()
    expect(emplacementOfPlanDetail("emp-")).toBeNull()
})

test("un chemin tapé retrouve son emplacement, séparateurs et casse libres", () => {
    const paths = new Map<string, readonly string[]>([
        ["h1", ["B", "R2", "E3", "H1"]],
        ["sol", ["A", "SOL"]],
    ])
    expect(findEmplacementByPath("B · R2 · E3 · H1", paths)).toBe("h1")
    expect(findEmplacementByPath("b r2 e3 h1", paths)).toBe("h1")
    expect(findEmplacementByPath("B/R2/E3/H1", paths)).toBe("h1")
    expect(findEmplacementByPath("a-sol", paths)).toBe("sol")
    expect(findEmplacementByPath("B R2 E3", paths)).toBeNull()
    expect(findEmplacementByPath("", paths)).toBeNull()
})
