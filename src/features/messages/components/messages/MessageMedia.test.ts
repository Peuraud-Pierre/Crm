import { describe, it, expect } from "@rstest/core"
import { getMediaBoxStyle } from "./MessageMedia"

describe("getMediaBoxStyle", () => {
    it("borne un paysage par la largeur, en gardant le format", () => {
        // Le GIF du signalement : 800x450 occupait toute la conversation.
        const box = getMediaBoxStyle(800 / 450)
        expect(box?.width).toBe(320)
        expect(box?.height).toBe(180)
    })

    it("borne un portrait par la hauteur", () => {
        const box = getMediaBoxStyle(600 / 1200)
        expect(box?.height).toBe(320)
        expect(box?.width).toBe(160)
    })

    it("ne dépasse jamais la boîte sur un format extrême", () => {
        for (const ratio of [0.1, 0.5, 1, 2, 10]) {
            const box = getMediaBoxStyle(ratio)
            expect(Number(box?.width)).toBeLessThanOrEqual(320)
            expect(Number(box?.height)).toBeLessThanOrEqual(320)
        }
    })

    it("conserve le format d’origine", () => {
        const ratio = 16 / 9
        const box = getMediaBoxStyle(ratio)
        const rendered = Number(box?.width) / Number(box?.height)
        expect(Math.abs(rendered - ratio)).toBeLessThan(0.02)
    })

    it("se contente de bornes quand les dimensions sont inconnues", () => {
        // Messages antérieurs à l’écriture de width/height dans meta.
        const box = getMediaBoxStyle(null)
        expect(box?.width).toBeUndefined()
        expect(box?.maxWidth).toBe(320)
        expect(box?.maxHeight).toBe(320)
    })
})
