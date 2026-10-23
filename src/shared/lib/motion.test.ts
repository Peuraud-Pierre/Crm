import { describe, expect, test } from "@rstest/core"
import { DURATION, EASE, staggerDelay, staggerStyle } from "./motion"

describe("staggerDelay", () => {
    test("le premier élément n'attend pas", () => {
        expect(staggerDelay(0)).toBe(0)
    })

    test("un index négatif ne produit pas de délai négatif", () => {
        expect(staggerDelay(-3)).toBe(0)
    })

    test("le délai croît linéairement avec l'index", () => {
        expect(staggerDelay(1)).toBe(40)
        expect(staggerDelay(3)).toBe(120)
    })

    test("le plafond borne les listes longues", () => {
        // Sans plafond, la 50e ligne d'un tableau apparaîtrait 2 s après la
        // première — l'utilisateur croit la page figée.
        expect(staggerDelay(50)).toBe(400)
    })

    test("le pas et le plafond sont paramétrables", () => {
        expect(staggerDelay(2, 30, 200)).toBe(60)
        expect(staggerDelay(20, 30, 200)).toBe(200)
    })
})

describe("staggerStyle", () => {
    test("ne produit aucun style quand le délai est nul", () => {
        // Évite un attribut `style` inutile sur le premier élément de chaque
        // liste.
        expect(staggerStyle(0)).toBeUndefined()
    })

    test("produit un animationDelay en millisecondes", () => {
        expect(staggerStyle(2)).toEqual({ animationDelay: "80ms" })
    })

    test("respecte le pas et le plafond passés en options", () => {
        expect(staggerStyle(1, { step: 30 })).toEqual({ animationDelay: "30ms" })
        expect(staggerStyle(99, { step: 30, cap: 200 })).toEqual({
            animationDelay: "200ms",
        })
    })
})

describe("tokens", () => {
    test("les durées sont exprimées en secondes, l'unité de framer-motion", () => {
        // Le pendant CSS est en ms (--transition-duration-*) ; confondre les
        // deux donne une animation 1000× trop longue, sans erreur.
        expect(DURATION.base).toBe(0.2)
        expect(DURATION.slow).toBe(0.3)
    })

    test("les easings sont des tableaux de 4 nombres exploitables par framer-motion", () => {
        for (const curve of Object.values(EASE)) {
            expect(curve).toHaveLength(4)
            expect(curve.every((n) => typeof n === "number")).toBe(true)
        }
    })
})
