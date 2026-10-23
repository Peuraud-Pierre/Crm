import { expect, test } from "@rstest/core"
import { pendingDotClass, pendingEventClass } from "./calendarConstants"

// Seul `false` (RDV Amelia en attente) doit passer en pointillé. Les RDV créés
// à la main n'ont pas de `confirmed` : un simple `!confirmed` aurait mis tout
// l'agenda en pointillé.
test("pendingEventClass : pointillé uniquement pour confirmed === false", () => {
    expect(pendingEventClass(false)).toContain("border-dashed")
    expect(pendingEventClass(true)).toBe("")
    expect(pendingEventClass(undefined)).toBe("")
    expect(pendingEventClass(null)).toBe("")
})

// Même garde côté pastille : `undefined` ne doit pas vider le fond de toutes
// les pastilles de la vue mois mobile.
test("pendingDotClass : losange uniquement pour confirmed === false", () => {
    expect(pendingDotClass(false)).toContain("rotate-45")
    expect(pendingDotClass(true)).toBe("")
    expect(pendingDotClass(undefined)).toBe("")
    expect(pendingDotClass(null)).toBe("")
})
