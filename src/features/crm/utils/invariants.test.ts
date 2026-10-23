import { describe, expect, test } from "@rstest/core"
import {
    assertClient,
    getBriefField,
    getCustomerKey,
    getCustomerName,
    isCustomerObject,
    isFicheAppro,
} from "./invariants"
import type { Client } from "@/features/crm/hooks/CRM_hook/use_client"
import { silenceExpectedLogs } from "@/shared/lib/testing"

// Ces tests passent volontairement des données invalides pour vérifier la
// garde : l'avertissement applicatif qui en résulte est attendu.
silenceExpectedLogs("[CRM] Invariant")

describe("isCustomerObject", () => {
    test("true pour un objet avec id/user_id/full_name", () => {
        expect(isCustomerObject({ id: "x" })).toBe(true)
        expect(isCustomerObject({ user_id: "y" })).toBe(true)
        expect(isCustomerObject({ full_name: "Z" })).toBe(true)
    })
    test("false pour string/null/undefined", () => {
        expect(isCustomerObject("uuid")).toBe(false)
        expect(isCustomerObject(null)).toBe(false)
        expect(isCustomerObject(undefined)).toBe(false)
    })
})

describe("getCustomerKey / getCustomerName", () => {
    test("string ref renvoie la string et le fallback name", () => {
        expect(getCustomerKey("abc")).toBe("abc")
        expect(getCustomerName("abc")).toBe("Utilisateur")
    })
    test("object ref renvoie id puis user_id en repli, et full_name", () => {
        expect(getCustomerKey({ id: "i", user_id: "u" })).toBe("i")
        expect(getCustomerKey({ user_id: "u" })).toBe("u")
        expect(getCustomerName({ full_name: "Alice" })).toBe("Alice")
    })
    test("null renvoie null/fallback", () => {
        expect(getCustomerKey(null)).toBeNull()
        expect(getCustomerName(null, "x")).toBe("x")
    })
})

describe("isFicheAppro / getBriefField", () => {
    test("type-guard et accès sûr", () => {
        const brief = { budget: 1000 } as Client["brief"]
        expect(isFicheAppro(brief)).toBe(true)
        expect(getBriefField(brief, "budget")).toBe(1000)
        expect(getBriefField("string-form", "budget")).toBeUndefined()
        expect(getBriefField(null, "budget")).toBeUndefined()
    })
})

describe("assertClient", () => {
    test("valide un client correct", () => {
        expect(assertClient({ id: "x", collum: 2 } as Client)).toBe(true)
    })
    test("rejette un client sans id", () => {
        expect(assertClient({ id: undefined } as Client)).toBe(false)
    })
    test("rejette une colonne hors plage", () => {
        expect(assertClient({ id: "x", collum: 42 } as Client)).toBe(false)
    })
})
