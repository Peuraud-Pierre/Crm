import { expect, test } from "@rstest/core"
import { focusFromSegments, selectionOfFocus } from "./planFocus"

/**
 * « Voir dans le plan 3D » : le chemin d'emplacement d'une balle désigne
 * la travée et la hauteur à faire briller, ou le sol d'une zone.
 */

test("une balle en rack vise sa travée et sa hauteur", () => {
    expect(focusFromSegments(["B", "R2", "E3", "H1"])).toEqual({
        kind: "shelf", row: "R2", shelf: "E3", level: "H1",
    })
})

test("une balle au sol de A ou D vise la zone", () => {
    expect(focusFromSegments(["D", "SOL"])).toEqual({ kind: "zone", zone: "D" })
    expect(focusFromSegments(["A", "SOL"])).toEqual({ kind: "zone", zone: "A" })
})

test("un chemin hors plan ne vise rien", () => {
    expect(focusFromSegments(null)).toBeNull()
    expect(focusFromSegments(["B", "R9", "E1", "H0"])).toBeNull()
    expect(focusFromSegments(["B", "R1"])).toBeNull()
    expect(focusFromSegments(["Z"])).toBeNull()
})

test("une travée ou une hauteur retirée du dessin ne vise rien", () => {
    expect(focusFromSegments(["B", "R4", "E5", "H0"])).toBeNull()
    expect(focusFromSegments(["B", "R2", "E1", "H1"])).toBeNull()
    expect(focusFromSegments(["B", "R2", "E1", "H0"])).toEqual({
        kind: "shelf", row: "R2", shelf: "E1", level: "H0",
    })
})

test("la cible sélectionne sa travée ou sa zone", () => {
    expect(selectionOfFocus({ kind: "shelf", row: "R1", shelf: "E2", level: "H0" })).toEqual({
        kind: "shelf", row: "R1", shelf: "E2",
    })
    expect(selectionOfFocus({ kind: "zone", zone: "A" })).toEqual({ kind: "zone", zone: "A" })
})
