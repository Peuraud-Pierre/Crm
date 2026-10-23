// ── MaskIcon.test.tsx ─────────────────────────────────────────────────────────
// Tests unitaires de MaskIcon — jusqu'ici sans aucun test, alors qu'il est
// partagé par 6 composants (ThematiqueItem, QRCard, QRDetailPanel, BriefPanel,
// FormatPanel, BiblioSidebar — voir son en-tête). Une régression ici (mauvais
// src, mask non appliqué) casserait silencieusement toutes ces icônes à la fois.

import { describe, expect, test } from "@rstest/core"
import { render } from "@testing-library/react"
import { MaskIcon } from "./MaskIcon"

describe("MaskIcon", () => {
    test("applique src comme mask-image (standard et -webkit-) avec mask-size: contain", () => {
        const { container } = render(<MaskIcon src="/bibliotheque/icons/question.svg" />)
        const span = container.querySelector("span")!
        expect(span.style.maskImage).toBe('url("/bibliotheque/icons/question.svg")')
        expect(span.style.webkitMaskImage).toBe('url("/bibliotheque/icons/question.svg")')
        expect(span.style.maskSize).toBe("contain")
        expect(span.style.webkitMaskSize).toBe("contain")
    })

    test("répercute un autre src dans le mask (pas de valeur figée)", () => {
        const { container } = render(<MaskIcon src="/bibliotheque/icons/email.svg" />)
        const span = container.querySelector("span")!
        expect(span.style.maskImage).toBe('url("/bibliotheque/icons/email.svg")')
    })

    test("porte toujours la classe shrink-0, en plus de className", () => {
        const { container } = render(<MaskIcon src="/x.svg" className="w-6 h-6 bg-current" />)
        const span = container.querySelector("span")!
        expect(span.className).toContain("shrink-0")
        expect(span.className).toContain("w-6")
        expect(span.className).toContain("h-6")
        expect(span.className).toContain("bg-current")
    })

    test("fonctionne sans className (juste shrink-0)", () => {
        const { container } = render(<MaskIcon src="/x.svg" />)
        const span = container.querySelector("span")!
        expect(span.className.trim()).toBe("shrink-0")
    })
})
