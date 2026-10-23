import { expect, test } from "@rstest/core"
import { SLOT_BLOCKING_TYPES } from "./eventTypes"

// Les RDV pris par un prospect via Amelia arrivent dans Event_calendar avec la
// nature du service (cf. ameliaServiceMapping du bridge Go), jamais
// "Non Disponible" : ils doivent déclencher la détection de conflit.
test("les natures RDV Amelia bloquent le créneau", () => {
    for (const nom of [
        "rdv physique achat",
        "rdv physique decouverte",
        "rdv decouverte visio",
        "rdv visio achat",
    ]) {
        expect(SLOT_BLOCKING_TYPES.has(nom)).toBe(true)
    }
})

test("les indisponibilités bloquent le créneau", () => {
    expect(SLOT_BLOCKING_TYPES.has("Non Disponible")).toBe(true)
})

test("les traces d'activité ne bloquent pas le créneau", () => {
    for (const nom of ["appel", "rdv visio reassort", "other", "divers"]) {
        expect(SLOT_BLOCKING_TYPES.has(nom)).toBe(false)
    }
})
