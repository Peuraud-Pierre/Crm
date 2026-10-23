// ── errors.test.ts ────────────────────────────────────────────────────────────
// Tests unitaires de BibliothequeServiceError / throwIfError — le wrapper qui
// uniformise les erreurs levées par la couche service (voir CLAUDE.md "couche
// service obligatoire" et le point d'audit "erreurs non typées de façon
// homogène").

import { describe, expect, test } from "@rstest/core"
import { BibliothequeServiceError, throwIfError } from "./errors"

describe("BibliothequeServiceError", () => {
    test("reprend le message d'une Error d'origine", () => {
        const err = new BibliothequeServiceError("op", new Error("boom"))
        expect(err.message).toBe("boom")
        expect(err.name).toBe("BibliothequeServiceError")
        expect(err).toBeInstanceOf(Error)
    })

    test("reprend le message d'un objet Postgrest-like ({ message, code })", () => {
        const cause = { code: "23505", message: "duplicate key" }
        const err = new BibliothequeServiceError("op", cause)
        expect(err.message).toBe("duplicate key")
        expect(err.cause).toBe(cause)
    })

    test("se rabat sur String(cause) si aucun message n'est trouvable", () => {
        const err = new BibliothequeServiceError("op", 42)
        expect(err.message).toBe("42")
    })

    test("conserve operation et cause tels quels", () => {
        const cause = new Error("x")
        const err = new BibliothequeServiceError("insertThematique", cause)
        expect(err.operation).toBe("insertThematique")
        expect(err.cause).toBe(cause)
    })
})

describe("throwIfError", () => {
    test("ne fait rien si error est null", () => {
        expect(() => throwIfError("op", null)).not.toThrow()
    })

    test("ne fait rien si error est undefined", () => {
        expect(() => throwIfError("op", undefined)).not.toThrow()
    })

    test("lève une BibliothequeServiceError si error est non-null", () => {
        const cause = new Error("échec")
        expect(() => throwIfError("removeQR", cause)).toThrow("échec")
        try {
            throwIfError("removeQR", cause)
        } catch (err) {
            expect(err).toBeInstanceOf(BibliothequeServiceError)
            expect((err as BibliothequeServiceError).operation).toBe("removeQR")
            expect((err as BibliothequeServiceError).cause).toBe(cause)
        }
    })
})
