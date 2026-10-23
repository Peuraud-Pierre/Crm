import { expect, test } from "@rstest/core"
import { looksLikeTrackpad, wheelIntent, wheelPixels, wheelZoomFactor, type WheelLike } from "./trackpad"

const wheel = (over: Partial<WheelLike> = {}): WheelLike => ({
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    deltaMode: 0,
    deltaX: 0,
    deltaY: 0,
    ...over,
})

test("pincer (ctrl + molette) zoome toujours, même vue inactive", () => {
    expect(wheelIntent(wheel({ ctrlKey: true, deltaY: -3.2 }), false)).toBe("zoom")
})

test("vue inactive : le glisser à deux doigts laisse défiler la page", () => {
    expect(wheelIntent(wheel({ deltaY: 6.5 }), false)).toBe("ignore")
})

test("vue active : deux doigts déplacent, Option + deux doigts font tourner", () => {
    expect(wheelIntent(wheel({ deltaX: 4, deltaY: 2 }), true)).toBe("pan")
    expect(wheelIntent(wheel({ deltaY: 3, altKey: true }), true)).toBe("rotate")
})

test("vue active : un cran de molette de souris zoome", () => {
    expect(wheelIntent(wheel({ deltaY: 100 }), true)).toBe("zoom")
    expect(wheelIntent(wheel({ deltaMode: 1, deltaY: 3 }), true)).toBe("zoom")
})

test("les deltas fins ou horizontaux sont ceux d'un pavé tactile", () => {
    expect(looksLikeTrackpad(wheel({ deltaY: 2.75 }))).toBe(true)
    expect(looksLikeTrackpad(wheel({ deltaX: -8, deltaY: 120 }))).toBe(true)
    expect(looksLikeTrackpad(wheel({ deltaY: 120 }))).toBe(false)
})

test("les deltas en lignes sont convertis en pixels", () => {
    expect(wheelPixels(wheel({ deltaMode: 1, deltaY: 3 }))).toEqual({ dx: 0, dy: 48 })
})

test("écarter les doigts rapproche, les resserrer éloigne, sans à-coup", () => {
    expect(wheelZoomFactor(-10)).toBeLessThan(1)
    expect(wheelZoomFactor(10)).toBeGreaterThan(1)
    expect(wheelZoomFactor(10_000)).toBeCloseTo(Math.E)
})
