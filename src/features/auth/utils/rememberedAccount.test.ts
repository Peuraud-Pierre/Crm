import { beforeEach, expect, test } from "@rstest/core"
import {
    forgetRememberedAccount,
    greeting,
    readFirstName,
    readLastEmail,
    rememberFirstName,
    writeLastEmail,
} from "./rememberedAccount"

beforeEach(() => {
    window.localStorage.clear()
})

test("keeps only the first name of the profile", () => {
    rememberFirstName("  Ethan   Martin ")
    expect(readFirstName()).toBe("Ethan")
})

test("ignores an empty profile name", () => {
    rememberFirstName("Ethan")
    rememberFirstName(undefined)
    rememberFirstName("   ")
    expect(readFirstName()).toBe("Ethan")
})

test("forgets both email and first name when switching account", () => {
    writeLastEmail("ana@exemple.fr")
    rememberFirstName("Ana")

    forgetRememberedAccount()

    expect(readLastEmail()).toBe("")
    expect(readFirstName()).toBe("")
})

test("greets according to the local hour", () => {
    const at = (h: number) => new Date(2026, 9, 12, h, 0)
    expect(greeting(at(4))).toBe("Bonsoir")
    expect(greeting(at(5))).toBe("Bonjour")
    expect(greeting(at(17))).toBe("Bonjour")
    expect(greeting(at(18))).toBe("Bonsoir")
})
