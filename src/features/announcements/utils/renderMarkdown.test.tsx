import { expect, test } from "@rstest/core"
import { renderToStaticMarkup } from "react-dom/server"
import { renderMarkdown, safeHref } from "./renderMarkdown"

/** Le HTML réellement produit, tel qu'il arrivera dans le document. */
function html(source: string): string {
    return renderToStaticMarkup(<>{renderMarkdown(source)}</>)
}

test("les paragraphes sont séparés par une ligne vide", () => {
    const result = html("Premier.\n\nSecond.")

    expect(result).toContain("Premier.")
    expect(result).toContain("Second.")
    expect(result.match(/<p /g)).toHaveLength(2)
})

test("les lignes consécutives forment un seul paragraphe", () => {
    expect(html("une ligne\net sa suite").match(/<p /g)).toHaveLength(1)
})

test("un intertitre devient un titre, pas un paragraphe", () => {
    expect(html("## Le titre")).toContain("<h3")
})

test("les puces forment une liste", () => {
    const result = html("- un\n- deux")

    expect(result).toContain("<ul")
    expect(result.match(/<li/g)).toHaveLength(2)
})

test("le gras et l'italique sont rendus", () => {
    expect(html("un mot **fort**")).toContain("<strong")
    expect(html("un mot *nuancé*")).toContain("<em>")
})

test("un lien http est rendu, avec rel de sécurité", () => {
    const result = html("[le site](https://exemple.fr)")

    expect(result).toContain('href="https://exemple.fr/"')
    expect(result).toContain('rel="noopener noreferrer"')
})

// ─── Injection ───────────────────────────────────────────────────────

test("le HTML saisi est affiché, jamais interprété", () => {
    const result = html('<img src=x onerror="alert(1)">')

    // Échappé : c'est du texte à l'écran, pas une balise dans le DOM.
    expect(result).toContain("&lt;img")
    expect(result).not.toContain("<img")
})

test("une balise script reste du texte", () => {
    const result = html("<script>alert(1)</script>")

    expect(result).not.toContain("<script>")
    expect(result).toContain("&lt;script&gt;")
})

test("un lien javascript: perd son lien et garde son libellé", () => {
    const result = html("[clique ici](javascript:alert(1))")

    expect(result).not.toContain("href")
    expect(result).toContain("clique ici")
})

test("safeHref refuse ce qui n'est pas du web et complète le protocole", () => {
    expect(safeHref("exemple.fr")).toBe("https://exemple.fr/")
    expect(safeHref("https://exemple.fr/page")).toBe("https://exemple.fr/page")
    expect(safeHref("javascript:alert(1)")).toBeNull()
    expect(safeHref("data:text/html,<script>")).toBeNull()
    expect(safeHref("   ")).toBeNull()
})
