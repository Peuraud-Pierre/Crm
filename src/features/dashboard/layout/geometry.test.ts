import { expect, test } from "@rstest/core"
import { GRID_COLS, GRID_GAP, ROW_UNIT } from "../constants"
import {
    canvasHeight,
    columnEdge,
    columnWidth,
    rectStyle,
    rowEdge,
    toGridDelta,
} from "./geometry"

/**
 * La conversion unités de grille → pixels.
 *
 * Tout est pur et sans React, mais la règle centrale est
 * contre-intuitive : on arrondit les **bords**, puis on en déduit la
 * taille. Arrondir la taille ferait dériver les gouttières de colonne en
 * colonne, et une bordure posée sur une coordonnée fractionnaire est
 * rendue sur deux pixels physiques à demi-opacité — du flou permanent sur
 * chaque carte. C'est le genre d'invariant qu'une refonte casse sans que
 * rien ne s'allume.
 */

/** Une largeur de canevas réaliste, volontairement non divisible par 12. */
const CANVAS = 1440

test("les onze gouttières sont déduites de la largeur disponible", () => {
    const colWidth = columnWidth(CANVAS)

    expect(colWidth * GRID_COLS + GRID_GAP * (GRID_COLS - 1)).toBeCloseTo(
        CANVAS,
        6
    )
})

test("la largeur d'une colonne est fractionnaire, et c'est assumé", () => {
    // Douze colonnes et onze gouttières tombent rarement rond : c'est
    // précisément pourquoi ce sont les bords qu'on arrondit, pas elle.
    expect(Number.isInteger(columnWidth(CANVAS))).toBe(false)
})

test("tous les bords de colonne sont des entiers", () => {
    const colWidth = columnWidth(CANVAS)

    for (let col = 0; col <= GRID_COLS; col++) {
        expect(Number.isInteger(columnEdge(col, colWidth))).toBe(true)
    }
})

test("le bord gauche de la première colonne est à zéro", () => {
    expect(columnEdge(0, columnWidth(CANVAS))).toBe(0)
})

test("la dernière colonne finit exactement au bord du canevas", () => {
    // Sans quoi le module le plus à droite déborderait, ou laisserait une
    // bande vide que rien n'explique.
    const colWidth = columnWidth(CANVAS)
    const right = columnEdge(GRID_COLS, colWidth) - GRID_GAP

    expect(right).toBe(CANVAS)
})

test("les gouttières ne dérivent pas d'une colonne à l'autre", () => {
    // Le défaut que l'arrondi des bords évite : avec un arrondi de la
    // taille, l'écart accumulé se voit à droite de la page.
    const colWidth = columnWidth(CANVAS)

    for (let col = 0; col < GRID_COLS; col++) {
        const gap =
            columnEdge(col + 1, colWidth) -
            (columnEdge(col + 1, colWidth) - GRID_GAP)
        expect(gap).toBe(GRID_GAP)
    }
})

test("deux modules adjacents laissent exactement une gouttière", () => {
    const colWidth = columnWidth(CANVAS)
    const left = rectStyle({ x: 0, y: 0, w: 6, h: 2 }, colWidth)
    const right = rectStyle({ x: 6, y: 0, w: 6, h: 2 }, colWidth)

    const leftEnd = Number(left.left) + Number(left.width)
    expect(Number(right.left) - leftEnd).toBe(GRID_GAP)
})

test("un module enjambe les gouttières qu'il couvre, au pixel d'arrondi près", () => {
    // Un module de 2 colonnes occupe 2 colonnes ET la gouttière entre
    // elles : le compter sans elle le laisserait plus étroit que la place
    // qu'il occupe réellement.
    //
    // L'égalité n'est pas exacte, et c'est le compromis assumé : les
    // bords sont arrondis indépendamment, donc une largeur qu'on en
    // déduit peut s'écarter d'un pixel de l'idéal algébrique. C'est le
    // prix d'un rendu net — l'inverse, arrondir la taille, donnerait des
    // largeurs cohérentes entre elles mais des bords fractionnaires,
    // donc du flou sur chaque carte.
    const colWidth = columnWidth(CANVAS)
    const one = Number(rectStyle({ x: 0, y: 0, w: 1, h: 1 }, colWidth).width)
    const two = Number(rectStyle({ x: 0, y: 0, w: 2, h: 1 }, colWidth).width)

    expect(Math.abs(two - (one * 2 + GRID_GAP))).toBeLessThanOrEqual(1)
})

test("l'écart d'arrondi ne s'accumule jamais au-delà d'un pixel", () => {
    // La garantie qui compte vraiment : quelle que soit la largeur du
    // module, son bord droit tombe sur le bord de colonne exact. C'est ce
    // qui empêche l'écart de dériver sur douze colonnes.
    const colWidth = columnWidth(CANVAS)

    for (let w = 1; w <= GRID_COLS; w++) {
        const style = rectStyle({ x: 0, y: 0, w, h: 1 }, colWidth)
        const right = Number(style.left) + Number(style.width)
        expect(right).toBe(columnEdge(w, colWidth) - GRID_GAP)
    }
})

test("la hauteur suit la même règle que la largeur", () => {
    const two = Number(rectStyle({ x: 0, y: 0, w: 1, h: 2 }, 100).height)

    expect(two).toBe(ROW_UNIT * 2 + GRID_GAP)
})

test("les lignes sont régulières et entières", () => {
    expect(rowEdge(0)).toBe(0)
    expect(rowEdge(1)).toBe(ROW_UNIT + GRID_GAP)
    expect(rowEdge(3) - rowEdge(2)).toBe(ROW_UNIT + GRID_GAP)
})

test("un canevas vide n'a aucune hauteur", () => {
    // Et non une gouttière négative, ce que donnerait la formule brute.
    expect(canvasHeight(0)).toBe(0)
})

test("la hauteur du canevas compte les gouttières intérieures, pas plus", () => {
    expect(canvasHeight(1)).toBe(ROW_UNIT)
    expect(canvasHeight(3)).toBe(ROW_UNIT * 3 + GRID_GAP * 2)
})

test("un déplacement inférieur à une demi-case ne bouge rien", () => {
    const colWidth = columnWidth(CANVAS)
    const step = colWidth + GRID_GAP

    expect(toGridDelta(step * 0.49, 0, colWidth).dx).toBe(0)
    expect(toGridDelta(0, (ROW_UNIT + GRID_GAP) * 0.49, colWidth).dy).toBe(0)
})

test("un déplacement franchit la case à la moitié", () => {
    // L'arrondi au plus proche, et non la troncature : sans cela il
    // faudrait traverser une case entière pour en gagner une, et le geste
    // donnerait l'impression de traîner.
    const colWidth = columnWidth(CANVAS)
    const step = colWidth + GRID_GAP

    expect(toGridDelta(step * 0.5, 0, colWidth).dx).toBe(1)
    expect(toGridDelta(step * 2.4, 0, colWidth).dx).toBe(2)
})

test("un déplacement vers le haut ou la gauche est négatif", () => {
    const colWidth = columnWidth(CANVAS)
    const { dx, dy } = toGridDelta(
        -(colWidth + GRID_GAP),
        -(ROW_UNIT + GRID_GAP) * 2,
        colWidth
    )

    expect(dx).toBe(-1)
    expect(dy).toBe(-2)
})

test("la position ne passe jamais par left/top fractionnaires", () => {
    // Une carte posée sur un demi-pixel rend ses bordures et son texte
    // sur deux pixels physiques : c'est du flou, en permanence.
    const colWidth = columnWidth(CANVAS)

    for (let x = 0; x < GRID_COLS; x++) {
        const style = rectStyle({ x, y: 1, w: 1, h: 1 }, colWidth)
        expect(Number.isInteger(Number(style.left))).toBe(true)
        expect(Number.isInteger(Number(style.top))).toBe(true)
        expect(Number.isInteger(Number(style.width))).toBe(true)
    }
})
