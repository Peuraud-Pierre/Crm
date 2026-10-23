import { expect, test } from "@rstest/core"
import { buildLabelSheetHtml, labelSheetPages } from "./codeLabelSheet"

/** Planche d'étiquettes ouverte dans une fenêtre d'impression dédiée. */

test("une étiquette par emplacement, avec son QR et son chemin", () => {
    const html = buildLabelSheetHtml([
        { path: "B · R2 · E3 · H1", zoneLabel: "Bags", qr: "data:image/png;base64,AAA" },
        { path: "A · SOL", zoneLabel: "Annexe", qr: "data:image/png;base64,BBB" },
    ])
    expect(html.match(/class="label"/g)).toHaveLength(2)
    expect(html).toContain('src="data:image/png;base64,AAA"')
    expect(html).toContain("B · R2 · E3 · H1")
    expect(html).toContain("Annexe")
    expect(html).toContain("window.print()")
})

test("un QR manquant laisse le chemin seul", () => {
    const html = buildLabelSheetHtml([{ path: "A · SOL", zoneLabel: "Annexe", qr: null }])
    expect(html).not.toContain("<img")
    expect(html).toContain("A · SOL")
})

test("les libellés sont échappés", () => {
    const html = buildLabelSheetHtml([{ path: '<b>&"x"', zoneLabel: "<script>", qr: null }])
    expect(html).toContain("&lt;b&gt;&amp;&quot;x&quot;")
    expect(html).not.toContain("<script>alert")
    expect(html).toContain("&lt;script&gt;")
})

test("nombre de pages A4 : 12 étiquettes par page", () => {
    expect(labelSheetPages(0)).toBe(0)
    expect(labelSheetPages(1)).toBe(1)
    expect(labelSheetPages(12)).toBe(1)
    expect(labelSheetPages(13)).toBe(2)
})
