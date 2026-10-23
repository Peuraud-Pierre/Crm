import { expect, test } from "@rstest/core"
import { toAuthFailure, toAuthMessage } from "./authErrors"

test("maps a GoTrue code to its French message", () => {
    expect(
        toAuthFailure({ code: "invalid_credentials", message: "Invalid login credentials" })
    ).toEqual({
        code: "invalid_credentials",
        message: "Email ou mot de passe incorrect.",
    })
})

test("falls back on the English message when GoTrue sends no code", () => {
    expect(
        toAuthFailure({ message: "captcha protection: request disallowed" }).code
    ).toBe("captcha_failed")
    expect(toAuthFailure({ message: "Invalid login credentials" }).code).toBe(
        "invalid_credentials"
    )
})

test("treats fetch failures as network errors", () => {
    expect(toAuthFailure(new TypeError("Failed to fetch")).code).toBe("network")
    expect(
        toAuthFailure({ name: "AuthRetryableFetchError", status: 0, message: "" }).code
    ).toBe("network")
})

test("keeps an unknown GoTrue code but shows a generic message", () => {
    expect(toAuthFailure({ code: "something_new", message: "whatever" })).toEqual({
        code: "something_new",
        message: "Une erreur est survenue. Réessayez.",
    })
    expect(toAuthMessage(null)).toBe("Une erreur est survenue. Réessayez.")
})
