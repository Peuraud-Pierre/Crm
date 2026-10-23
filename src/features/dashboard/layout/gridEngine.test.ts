import { expect, test } from "@rstest/core"
import type { SizeBounds } from "@/shared/types/widget.types"
import { MAX_ROWS, MIN_COLS, MIN_ROWS } from "../constants"
import type { LayoutItem } from "../types/layout.types"
import {
    clampRect,
    collides,
    compact,
    contentRows,
    firstFreeSpot,
    normalize,
    place,
    resizeRect,
    resolveCollisions,
    stackOrder,
} from "./gridEngine"

const FREE: SizeBounds = { minW: 1, maxW: 12, minH: 1, maxH: 12 }

function item(
    instanceId: string,
    x: number,
    y: number,
    w: number,
    h: number
): LayoutItem {
    return { instanceId, widgetId: `w.${instanceId}`, x, y, w, h, settings: {} }
}

/** Aucune paire de modules ne se chevauche. */
function noOverlap(items: LayoutItem[]): boolean {
    return items.every((a, i) =>
        items.slice(i + 1).every((b) => !collides(a, b))
    )
}

test("deux rectangles jointifs ne se chevauchent pas", () => {
    expect(collides(item("a", 0, 0, 6, 2), item("b", 6, 0, 6, 2))).toBe(false)
    expect(collides(item("a", 0, 0, 6, 2), item("b", 0, 2, 6, 2))).toBe(false)
    expect(collides(item("a", 0, 0, 6, 2), item("b", 5, 1, 6, 2))).toBe(true)
})

test("la largeur est bornée avant la position, pas l'inverse", () => {
    // Un module de 6 colonnes lâché en x=10 est décalé à x=6, il n'est
    // pas rétréci à 2 colonnes.
    expect(clampRect({ x: 10, y: 0, w: 6, h: 2 }, FREE)).toEqual({
        x: 6,
        y: 0,
        w: 6,
        h: 2,
    })
})

test("clampRect respecte les bornes déclarées par le widget", () => {
    const bounds: SizeBounds = { minW: 4, maxW: 8, minH: 2, maxH: 3 }

    expect(clampRect({ x: -3, y: -1, w: 1, h: 9 }, bounds)).toEqual({
        x: 0,
        y: 0,
        w: 4,
        h: 3,
    })
})

test("un module déposé sur un autre le pousse vers le bas, sans permuter", () => {
    const items = [item("cible", 0, 0, 6, 2), item("porte", 0, 0, 6, 2)]

    const result = resolveCollisions(items, "porte")

    // Celui qu'on déplace ne bouge pas ; c'est l'autre qui descend.
    expect(result.find((i) => i.instanceId === "porte")).toMatchObject({ y: 0 })
    expect(result.find((i) => i.instanceId === "cible")).toMatchObject({ y: 2 })
    expect(noOverlap(result)).toBe(true)
})

test("la poussée se propage en cascade sur une seule passe", () => {
    const items = [
        item("a", 0, 0, 12, 2),
        item("b", 0, 2, 12, 2),
        item("intrus", 0, 0, 12, 2),
    ]

    const result = resolveCollisions(items, "intrus")

    expect(result.find((i) => i.instanceId === "a")).toMatchObject({ y: 2 })
    expect(result.find((i) => i.instanceId === "b")).toMatchObject({ y: 4 })
    expect(noOverlap(result)).toBe(true)
})

test("la gravité remonte les modules sans créer de chevauchement", () => {
    const items = [item("a", 0, 5, 6, 2), item("b", 6, 9, 6, 4)]

    const result = compact(items)

    expect(result).toEqual([item("a", 0, 0, 6, 2), item("b", 6, 0, 6, 4)])
})

test("la gravité conserve l'ordre du tableau d'origine", () => {
    // L'ordre du tableau n'a plus de sens visuel, mais le préserver évite
    // que React remonte toutes les cartes à chaque geste.
    const items = [item("bas", 0, 8, 6, 2), item("haut", 0, 0, 6, 2)]

    expect(compact(items).map((i) => i.instanceId)).toEqual(["bas", "haut"])
})

test("un retrait fait remonter ce qui suit", () => {
    const items = [item("a", 0, 0, 12, 2), item("b", 0, 2, 12, 2)]

    const result = compact(items.filter((i) => i.instanceId !== "a"))

    expect(result[0]).toMatchObject({ instanceId: "b", y: 0 })
})

test("place enchaîne bornage, poussée et gravité", () => {
    const items = [item("a", 0, 0, 6, 2), item("b", 6, 0, 6, 2)]

    // On étire `a` sur toute la largeur : `b` ne peut plus tenir à côté.
    const result = place(items, "a", { x: 0, y: 0, w: 12, h: 2 }, FREE)

    expect(result.find((i) => i.instanceId === "a")).toMatchObject({ w: 12 })
    expect(result.find((i) => i.instanceId === "b")).toMatchObject({ y: 2 })
    expect(noOverlap(result)).toBe(true)
})

test("place sur un identifiant inconnu laisse la disposition intacte", () => {
    const items = [item("a", 0, 0, 6, 2)]

    expect(place(items, "fantome", { x: 0, y: 0, w: 6, h: 2 }, FREE)).toEqual(
        items
    )
})

test("le premier emplacement libre comble un trou plutôt que d'aller en bas", () => {
    const items = [item("a", 0, 0, 6, 2), item("b", 0, 2, 12, 2)]

    // Il reste six colonnes libres à droite de `a`, sur la première ligne.
    expect(firstFreeSpot(items, 6, 2)).toEqual({ x: 6, y: 0 })
})

test("sans trou, le nouveau module se pose sous les autres", () => {
    const items = [item("a", 0, 0, 12, 3)]

    expect(firstFreeSpot(items, 6, 2)).toEqual({ x: 0, y: 3 })
})

test("firstFreeSpot sur un canevas vide place en haut à gauche", () => {
    expect(firstFreeSpot([], 6, 2)).toEqual({ x: 0, y: 0 })
})

test("contentRows mesure la dernière ligne occupée", () => {
    expect(contentRows([item("a", 0, 0, 6, 2), item("b", 6, 3, 6, 4)])).toBe(7)
    expect(contentRows([])).toBe(0)
})

test("l'empilement mobile suit l'ordre de lecture", () => {
    const items = [
        item("droite-haut", 6, 0, 6, 2),
        item("bas", 0, 4, 12, 2),
        item("gauche-haut", 0, 0, 6, 2),
    ]

    expect(stackOrder(items).map((i) => i.instanceId)).toEqual([
        "gauche-haut",
        "droite-haut",
        "bas",
    ])
})

// ─── Gravité épinglée ────────────────────────────────────────────────

test("la gravité épargne le module épinglé", () => {
    const items = [item("libre", 0, 5, 6, 2), item("epingle", 6, 5, 6, 2)]

    const result = compact(items, "epingle")

    expect(result.find((i) => i.instanceId === "libre")).toMatchObject({ y: 0 })
    expect(result.find((i) => i.instanceId === "epingle")).toMatchObject({
        y: 5,
    })
})

test("un module posé dans le vide y reste", () => {
    // Le geste que l'ancienne gravité annulait : on descend un module
    // dans une zone libre, il remontait au relâchement.
    const items = [item("a", 0, 0, 6, 2), item("b", 6, 0, 6, 2)]

    const result = place(items, "b", { x: 6, y: 6, w: 6, h: 2 }, FREE)

    expect(result.find((i) => i.instanceId === "b")).toMatchObject({ y: 6 })
})

test("un module sous l'épingle ne remonte pas à travers", () => {
    const items = [item("epingle", 0, 3, 12, 2), item("dessous", 0, 5, 12, 2)]

    const result = compact(items, "epingle")

    expect(result.find((i) => i.instanceId === "dessous")).toMatchObject({
        y: 5,
    })
    expect(noOverlap(result)).toBe(true)
})

test("sans épingle, la gravité s'applique à tous", () => {
    const items = [item("a", 0, 4, 12, 2), item("b", 0, 9, 12, 2)]

    expect(compact(items)).toEqual([item("a", 0, 0, 12, 2), item("b", 0, 2, 12, 2)])
})

// ─── Plafond de hauteur ──────────────────────────────────────────────

test("sans maxH déclaré, la hauteur n'est bornée que par le garde-fou", () => {
    const uncapped: SizeBounds = { minW: 1, maxW: 12, minH: 2 }

    expect(clampRect({ x: 0, y: 0, w: 6, h: 30 }, uncapped)).toMatchObject({
        h: 30,
    })
    expect(clampRect({ x: 0, y: 0, w: 6, h: 9999 }, uncapped)).toMatchObject({
        h: MAX_ROWS,
    })
})

// ─── Redimensionnement par les bords ─────────────────────────────────

const ORIGIN = { x: 3, y: 4, w: 6, h: 5 }

test("tirer par l'est n'ancre que le bord gauche", () => {
    expect(resizeRect(ORIGIN, "e", 2, 0, FREE)).toEqual({
        x: 3,
        y: 4,
        w: 8,
        h: 5,
    })
})

test("tirer par l'ouest laisse le bord droit en place", () => {
    // Bord droit d'origine : 3 + 6 = 9. Il ne doit pas bouger.
    const result = resizeRect(ORIGIN, "w", -2, 0, FREE)

    expect(result).toEqual({ x: 1, y: 4, w: 8, h: 5 })
    expect(result.x + result.w).toBe(ORIGIN.x + ORIGIN.w)
})

test("tirer par le nord laisse le bord bas en place", () => {
    // Bord bas d'origine : 4 + 5 = 9.
    const result = resizeRect(ORIGIN, "n", 0, -3, FREE)

    expect(result).toEqual({ x: 3, y: 1, w: 6, h: 8 })
    expect(result.y + result.h).toBe(ORIGIN.y + ORIGIN.h)
})

test("rétrécir par le nord raccourcit par le haut, pas par le bas", () => {
    const result = resizeRect(ORIGIN, "n", 0, 2, FREE)

    expect(result).toEqual({ x: 3, y: 6, w: 6, h: 3 })
    expect(result.y + result.h).toBe(ORIGIN.y + ORIGIN.h)
})

test("à la butée minimale, la position se fige au lieu de glisser", () => {
    const bounds: SizeBounds = { minW: 4, maxW: 12, minH: 3 }

    // On rétrécit par l'ouest bien au-delà de `minW` : la largeur bute à
    // 4 et `x` s'arrête à 5, le bord droit restant à 9.
    const west = resizeRect(ORIGIN, "w", 99, 0, bounds)
    expect(west).toEqual({ x: 5, y: 4, w: 4, h: 5 })

    const north = resizeRect(ORIGIN, "n", 0, 99, bounds)
    expect(north).toEqual({ x: 3, y: 6, w: 6, h: 3 })
})

test("le redimensionnement s'arrête aux bords de la grille", () => {
    // Vers l'ouest, `x` ne descend pas sous 0.
    expect(resizeRect(ORIGIN, "w", -99, 0, FREE)).toMatchObject({ x: 0, w: 9 })

    // Vers le nord, `y` ne descend pas sous 0.
    expect(resizeRect(ORIGIN, "n", 0, -99, FREE)).toMatchObject({ y: 0, h: 9 })

    // Vers l'est, la largeur bute sur la douzième colonne.
    expect(resizeRect(ORIGIN, "e", 99, 0, FREE)).toMatchObject({ x: 3, w: 9 })
})

test("un coin combine ses deux bords", () => {
    expect(resizeRect(ORIGIN, "nw", -1, -1, FREE)).toEqual({
        x: 2,
        y: 3,
        w: 7,
        h: 6,
    })

    expect(resizeRect(ORIGIN, "se", 1, 1, FREE)).toEqual({
        x: 3,
        y: 4,
        w: 7,
        h: 6,
    })
})

test("un redimensionnement vers le bas n'est plus annulé par la gravité", () => {
    // `place` épingle : rétrécir par le nord doit tenir au relâchement.
    const items = [item("seul", 0, 0, 6, 6)]

    const result = place(items, "seul", resizeRect(
        { x: 0, y: 0, w: 6, h: 6 },
        "n",
        0,
        2,
        FREE
    ), FREE)

    expect(result[0]).toMatchObject({ y: 2, h: 4 })
})

test("sans bornes déclarées, seuls les planchers du moteur s'appliquent", () => {
    // Le cas courant : plus aucun module ne déclare de bornes.
    const free: SizeBounds = {}

    // Vers le bas, on s'arrête au plancher — pas à la largeur qu'un
    // registre aurait imposée.
    expect(clampRect({ x: 0, y: 0, w: 1, h: 1 }, free)).toMatchObject({
        w: MIN_COLS,
        h: MIN_ROWS,
    })

    // Vers le haut, toute la grille est ouverte en largeur, et seul le
    // garde-fou borne la hauteur.
    expect(clampRect({ x: 0, y: 0, w: 12, h: 25 }, free)).toMatchObject({
        w: 12,
        h: 25,
    })
    expect(clampRect({ x: 0, y: 0, w: 99, h: 99 }, free)).toMatchObject({
        w: 12,
        h: MAX_ROWS,
    })
})

test("un module peut descendre à deux colonnes sans déclaration", () => {
    // Les modules déclaraient minW: 3 ou 4 — le tiers de la page était
    // le minimum imposé. Ce n'est plus le cas.
    expect(
        resizeRect({ x: 0, y: 0, w: 6, h: 4 }, "e", -99, 0, {})
    ).toMatchObject({ w: MIN_COLS })
})

/* ── Préservation d'identité ─────────────────────────────────────────
 *
 * Le moteur réutilise l'objet reçu quand la position ne change pas. Ce
 * n'est pas un détail interne : c'est ce qui permet à `WidgetCard` d'être
 * mémoïsé, donc au canevas de ne pas re-rendre quinze modules et leur
 * contenu à chaque case franchie. Sans ces tests, un `{ ...item }`
 * réintroduit par mégarde annulerait le gain sans qu'aucun autre test ne
 * bronche.
 */

test("un module que le geste ne touche pas garde son identité", () => {
    const a = item("a", 0, 0, 6, 2)
    const b = item("b", 6, 0, 6, 2)

    const next = place([a, b], "a", { x: 0, y: 0, w: 6, h: 2 }, FREE)

    expect(next.find((i) => i.instanceId === "b")).toBe(b)
})

test("un geste sans effet ne renouvelle aucune identité", () => {
    const items = [
        item("a", 0, 0, 6, 2),
        item("b", 6, 0, 6, 2),
        item("c", 0, 2, 12, 3),
    ]

    const next = place(items, "a", { x: 0, y: 0, w: 6, h: 2 }, FREE)

    expect(next.every((n, k) => n === items[k])).toBe(true)
})

test("seuls les modules réellement déplacés changent d'identité", () => {
    const a = item("a", 0, 0, 6, 2)
    const b = item("b", 6, 0, 6, 2)

    // `a` s'élargit sur toute la largeur : `b` n'a plus de place et descend.
    const next = place([a, b], "a", { x: 0, y: 0, w: 12, h: 2 }, FREE)

    expect(next.find((i) => i.instanceId === "a")).not.toBe(a)
    expect(next.find((i) => i.instanceId === "b")).not.toBe(b)
})

test("la gravité qui ne remonte rien préserve les identités", () => {
    const items = [item("a", 0, 0, 6, 2), item("b", 0, 2, 6, 2)]

    expect(compact(items).every((n, k) => n === items[k])).toBe(true)
})

test("normalize sur une disposition déjà saine ne touche à rien", () => {
    const items = [item("a", 0, 0, 4, 2), item("b", 4, 0, 4, 2)]

    expect(normalize(items).every((n, k) => n === items[k])).toBe(true)
})

test("le moteur ne modifie jamais l'objet qu'on lui donne", () => {
    const a = item("a", 0, 0, 6, 2)
    const b = item("b", 0, 1, 6, 2)
    const before = JSON.stringify([a, b])

    place([a, b], "a", { x: 0, y: 4, w: 6, h: 2 }, FREE)

    expect(JSON.stringify([a, b])).toBe(before)
})
