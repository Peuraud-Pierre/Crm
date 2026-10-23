import { describe, expect, test } from "@rstest/core"
import { getErrorMessage } from "./errors"

describe("getErrorMessage", () => {
    test("extrait le message d'une Error", () => {
        expect(getErrorMessage(new Error("boom"))).toBe("boom")
    })

    test("renvoie la string telle quelle", () => {
        expect(getErrorMessage("ouch")).toBe("ouch")
    })

    test("extrait le champ message d'un objet plain", () => {
        expect(getErrorMessage({ message: "supabase failed" })).toBe(
            "supabase failed"
        )
    })

    test("extrait le champ error d'un objet plain", () => {
        expect(getErrorMessage({ error: "api error" })).toBe("api error")
    })

    test("renvoie un défaut pour null/undefined/objets vides", () => {
        expect(getErrorMessage(null)).toBe("Erreur inconnue")
        expect(getErrorMessage(undefined)).toBe("Erreur inconnue")
        expect(getErrorMessage({})).toBe("Erreur inconnue")
        expect(getErrorMessage(42)).toBe("Erreur inconnue")
    })
})
