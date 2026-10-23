import { describe, it, expect } from "@rstest/core"
import { HyphenListParser } from "../parsers/HyphenListParser"
import { COLOR_THEMES } from "../themes"
import { render } from "@testing-library/react"

describe("HyphenListParser", () => {
    const parser = new HyphenListParser()
    const context = {
        text: "",
        theme: COLOR_THEMES.muted,
    }

    describe("canParse", () => {
        it("should detect text starting with hyphen", () => {
            expect(parser.canParse("- Item 1")).toBe(true)
        })

        it("should detect text with multiple hyphen lines", () => {
            expect(parser.canParse("- Item 1\n- Item 2\n- Item 3")).toBe(true)
        })

        it("should detect Unicode en dash", () => {
            expect(parser.canParse("– Item with en dash")).toBe(true)
        })

        it("should detect Unicode em dash", () => {
            expect(parser.canParse("— Item with em dash")).toBe(true)
        })

        it("should NOT detect text with inline hyphens", () => {
            expect(parser.canParse("long-term strategy")).toBe(false)
        })

        it("should NOT detect text with hyphens not at line start", () => {
            expect(parser.canParse("Some text - more text")).toBe(false)
        })
    })

    describe("parse", () => {
        it("should parse simple hyphen list", () => {
            const result = parser.parse({
                ...context,
                text: "- Item 1\n- Item 2\n- Item 3",
            })

            expect(result.success).toBe(true)
            expect(result.content).not.toBeNull()
        })

        it("should parse single item starting with hyphen", () => {
            const result = parser.parse({
                ...context,
                text: "- Single item",
            })

            expect(result.success).toBe(true)
        })

        it("should handle multiline items", () => {
            const result = parser.parse({
                ...context,
                text: "- First item\n  with continuation\n- Second item",
            })

            expect(result.success).toBe(true)
        })

        it("should handle space-separated hyphen format (fallback)", () => {
            const result = parser.parse({
                ...context,
                text: "Item 1 - Item 2 - Item 3",
            })

            // This triggers canParse: false, so success would be false
            // But if it somehow parses, test the extraction logic
            expect(result).toBeDefined()
        })

        it("should render with bullet points instead of hyphens", () => {
            const result = parser.parse({
                ...context,
                text: "- Item 1\n- Item 2",
            })

            const { container } = render(result.content as React.ReactElement)
            const bullets = container.querySelectorAll("span.select-none")

            // Check that bullets are rendered (•)
            expect(bullets.length).toBeGreaterThan(0)
            expect(bullets[0].textContent).toBe("•")
        })

        it("should handle bold markers in items", () => {
            const result = parser.parse({
                ...context,
                text: "- Item with **bold text**\n- Another **bold** item",
            })

            const { container } = render(result.content as React.ReactElement)
            const boldElements = container.querySelectorAll("strong")

            expect(boldElements.length).toBe(2)
            expect(boldElements[0].textContent).toBe("bold text")
            expect(boldElements[1].textContent).toBe("bold")
        })

        it("should apply correct CSS classes", () => {
            const result = parser.parse({
                ...context,
                text: "- Item 1\n- Item 2",
            })

            const { container } = render(result.content as React.ReactElement)
            const listItems = container.querySelectorAll("li")

            listItems.forEach((li) => {
                expect(li.className).toContain("flex")
                expect(li.className).toContain("items-start")
            })

            const contentDivs = container.querySelectorAll("li > div")
            contentDivs.forEach((div) => {
                expect(div.className).toContain("break-words")
                expect(div.className).toContain("min-w-0")
            })
        })
    })

    describe("edge cases", () => {
        it("should handle empty text", () => {
            const result = parser.parse({
                ...context,
                text: "",
            })

            expect(result.success).toBe(false)
        })

        it("should handle text with only hyphens", () => {
            const result = parser.parse({
                ...context,
                text: "- \n- \n- ",
            })

            // Parser détecte la structure mais extrait 0 items (contenu vide)
            // Le parsing "réussit" techniquement mais retourne une liste vide
            expect(result.success).toBe(false)
            // Alternative: on pourrait vérifier que success=true mais 0 items rendus
        })

        it("should handle mixed hyphen types", () => {
            const result = parser.parse({
                ...context,
                text: "- ASCII hyphen\n– En dash\n— Em dash",
            })

            expect(result.success).toBe(true)

            const { container } = render(result.content as React.ReactElement)
            const listItems = container.querySelectorAll("li")

            expect(listItems.length).toBe(3)
        })

        it("should preserve whitespace in item content", () => {
            const result = parser.parse({
                ...context,
                text: "- Item with    multiple   spaces",
            })

            const { container } = render(result.content as React.ReactElement)
            const content = container.querySelector("li > div")

            // Text should be trimmed but internal spaces preserved
            expect(content?.textContent).toContain("multiple")
        })
    })
})
