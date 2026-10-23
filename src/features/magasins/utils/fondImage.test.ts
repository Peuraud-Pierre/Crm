import { expect, test } from "@rstest/core"
import { defaultCalage, FondImageError, isPdf, toFondImage } from "./fondImage"

test("defaultCalage fait tenir le plan dans le magasin, proportions gardées", () => {
    // Plan large (2:1) dans un magasin 20 × 15 : limité par la largeur.
    expect(defaultCalage({ width: 2000, height: 1000 }, { width: 20, depth: 15 })).toEqual({
        fond_x: 0, fond_y: 0, fond_largeur: 20, fond_profondeur: 10, fond_opacite: 0.5,
    })
    // Plan haut (1:2) : limité par la profondeur.
    expect(defaultCalage({ width: 1000, height: 2000 }, { width: 20, depth: 15 }, 0.7)).toEqual({
        fond_x: 0, fond_y: 0, fond_largeur: 7.5, fond_profondeur: 15, fond_opacite: 0.7,
    })
})

test("isPdf reconnaît un PDF par type ou par extension", () => {
    expect(isPdf(new File(["x"], "plan.PDF"))).toBe(true)
    expect(isPdf(new File(["x"], "plan", { type: "application/pdf" }))).toBe(true)
    expect(isPdf(new File(["x"], "plan.png", { type: "image/png" }))).toBe(false)
})

test("toFondImage refuse un format inconnu en nommant le fichier", async () => {
    await expect(toFondImage(new File(["x"], "plan.dwg"))).rejects.toBeInstanceOf(FondImageError)
    await expect(toFondImage(new File(["x"], "plan.dwg"))).rejects.toThrow(/plan\.dwg/)
})
