import { describe, expect, test } from "@rstest/core"
import {
    buildCategoryTag,
    categoryNameKey,
    normalizeCategoryName,
    normalizeCategoryTag,
    tagKey,
} from "./categoryNaming"

describe("normalizeCategoryName", () => {
    test("met en majuscules et réduit les espaces internes", () => {
        expect(normalizeCategoryName("  blouson   jean ")).toBe("BLOUSON JEAN")
    })

    test("conserve les accents — c'est du texte destiné à être lu", () => {
        expect(normalizeCategoryName("vêtements d'été")).toBe("VÊTEMENTS D'ÉTÉ")
    })

    test("est idempotente", () => {
        const once = normalizeCategoryName("sweat à capuche")
        expect(normalizeCategoryName(once)).toBe(once)
    })

    test("un nom vide reste vide", () => {
        expect(normalizeCategoryName("   ")).toBe("")
    })
})

describe("categoryNameKey", () => {
    test("la casse et les espaces surnuméraires ne distinguent pas deux noms", () => {
        expect(categoryNameKey("blouson  jean")).toBe(categoryNameKey("BLOUSON JEAN"))
    })

    test("les accents SI — « pêche » et « peche » sont deux mots différents", () => {
        expect(categoryNameKey("pêche")).not.toBe(categoryNameKey("peche"))
    })
})

describe("buildCategoryTag — les cas de référence", () => {
    const cases: [string, string][] = [
        ["jean homme", "JEHO"],
        ["sweat capuche", "SWCA"],
        ["blouson en jean", "BLJE"],
        ["tshirt", "TSHI"],
        ["chemise manches longues", "CHMA"],
    ]

    for (const [name, expected] of cases) {
        test(`« ${name} » → ${expected}`, () => {
            expect(buildCategoryTag(name, [])).toBe(expected)
        })
    }
})

describe("buildCategoryTag — mots de liaison", () => {
    test("les mots de liaison sont ignorés, y compris après apostrophe", () => {
        expect(buildCategoryTag("vêtements d'été", [])).toBe("VEET")
    })

    test("un nom fait UNIQUEMENT de mots de liaison garde quand même un tag", () => {
        expect(buildCategoryTag("de la", [])).toBe("DELA")
    })

    test("l'accent de « à » est replié avant le filtrage", () => {
        expect(buildCategoryTag("sweat à capuche", [])).toBe("SWCA")
    })
})

describe("buildCategoryTag — noms trop courts", () => {
    test("complète avec X, jamais avec un chiffre", () => {
        expect(buildCategoryTag("top", [])).toBe("TOPX")
    })

    test("une seule lettre reste exploitable", () => {
        expect(buildCategoryTag("v", [])).toBe("VXXX")
    })

    test("un premier mot d'une lettre ne décale pas le second", () => {
        expect(buildCategoryTag("v neck", [])).toBe("VNEX")
    })

    test("un nom sans lettre ni chiffre retombe sur une base neutre", () => {
        expect(buildCategoryTag("   ", [])).toBe("CATX")
        expect(buildCategoryTag("!!! ---", [])).toBe("CATX")
    })
})

describe("buildCategoryTag — collisions", () => {
    test("la variante reste dans les 4 caractères que le BIN lit", () => {
        const tag = buildCategoryTag("jean homme", ["JEHO"])
        expect(tag).toBe("JEH2")
        expect(tag).toHaveLength(4)
    })

    test("les variantes à un chiffre s'épuisent avant celles à deux", () => {
        const taken = ["JEHO", "JEH2", "JEH3", "JEH4", "JEH5", "JEH6", "JEH7", "JEH8", "JEH9"]
        expect(buildCategoryTag("jean homme", taken)).toBe("JE10")
    })

    test("un tag existant en minuscules bloque quand même la base", () => {
        expect(buildCategoryTag("jean homme", ["jeho"])).toBe("JEH2")
    })

    test("un tag existant plus long que 4 bloque sur ses 4 premiers caractères", () => {
        expect(buildCategoryTag("jean homme", ["JEHOXXXX"])).toBe("JEH2")
    })

    test("les tags vides ou nuls n'occupent aucune place", () => {
        expect(buildCategoryTag("jean homme", ["", null, undefined])).toBe("JEHO")
    })

    test("les 99 variantes épuisées → null, jamais un 5ᵉ caractère", () => {
        const taken = ["JEHO"]
        for (let d = 2; d <= 9; d++) taken.push(`JEH${d}`)
        for (let p = 10; p <= 99; p++) taken.push(`JE${p}`)

        expect(buildCategoryTag("jean homme", taken)).toBeNull()
    })
})

describe("normalizeCategoryTag / tagKey", () => {
    test("un tag saisi est replié, mis en majuscules et purgé", () => {
        expect(normalizeCategoryTag(" jé-ho ")).toBe("JEHO")
    })

    test("un tag saisi est borné à 8 caractères, comme le champ du formulaire", () => {
        expect(normalizeCategoryTag("ABCDEFGHIJ")).toBe("ABCDEFGH")
    })

    test("tagKey ne garde que ce que le BIN lit", () => {
        expect(tagKey("ABCDEFGH")).toBe("ABCD")
    })

    test("un tag absent ne produit pas de clé", () => {
        expect(tagKey(null)).toBe("")
        expect(tagKey(undefined)).toBe("")
        expect(tagKey("")).toBe("")
    })
})
