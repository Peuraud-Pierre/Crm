import { expect, test } from "@rstest/core"
import { isCountedSource } from "./statsEligibility"

/** Quels RDV entrent dans les stats de prise de RDV, selon leur origine. */

test("un RDV créé depuis le CRM compte", () => {
    expect(isCountedSource({ source: "crm" })).toBe(true)
})

test("un RDV Amelia ne compte qu'une fois confirmé depuis le CRM", () => {
    expect(isCountedSource({ source: "amelia" })).toBe(false)
    expect(isCountedSource({ source: "Amelia", confirmed_by: null })).toBe(false)
    expect(isCountedSource({ source: "amelia", confirmed_by: "user-1" })).toBe(true)
})

test("l'alias `src` des lignes brutes est lu aussi", () => {
    expect(isCountedSource({ src: "crm" })).toBe(true)
})
