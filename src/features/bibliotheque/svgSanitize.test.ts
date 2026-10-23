import { expect, test } from "@rstest/core"
import { sanitizeSvgText } from "./utils"

const ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M4 4h16v16H4z"/></svg>'

test("laisse passer une icône légitime, racine et tracé conservés", () => {
    const clean = sanitizeSvgText(ICON)
    expect(clean).not.toBe(null)
    expect(clean).toContain("<svg")
    expect(clean).toContain("<path")
})

/**
 * XSS stocké : le fichier est servi depuis une URL publique et peut être
 * ouvert directement dans le navigateur, hors de tout <img>.
 */
test("retire le script sans rejeter le reste du dessin", () => {
    const clean = sanitizeSvgText(
        '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><path d="M0 0h9v9H0z"/></svg>'
    )
    expect(clean).not.toBe(null)
    expect(clean).not.toContain("script")
    expect(clean).not.toContain("alert")
    expect(clean).toContain("<path")
})

test("retire les gestionnaires d'événement et les URI javascript:", () => {
    const clean = sanitizeSvgText(
        '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)">' +
            '<a href="javascript:alert(2)"><circle r="5" onclick="alert(3)"/></a></svg>'
    )
    expect(clean).not.toBe(null)
    expect(clean?.toLowerCase()).not.toContain("onload")
    expect(clean?.toLowerCase()).not.toContain("onclick")
    expect(clean?.toLowerCase()).not.toContain("javascript:")
})

test("retire foreignObject et le HTML qu'il transporte", () => {
    const clean = sanitizeSvgText(
        '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject>' +
            '<body xmlns="http://www.w3.org/1999/xhtml"><script>alert(1)</script></body>' +
            '</foreignObject><path d="M0 0h9v9H0z"/></svg>'
    )
    expect(clean).not.toBe(null)
    expect(clean?.toLowerCase()).not.toContain("foreignobject")
    expect(clean).not.toContain("alert")
    expect(clean).toContain("<path")
})

/**
 * Un fichier dont il ne reste rien après nettoyage n'est pas une icône : le
 * téléverser produirait une image invisible, sans que personne le remarque.
 */
test("rejette un SVG entièrement composé de contenu retiré", () => {
    expect(
        sanitizeSvgText(
            '<svg xmlns="http://www.w3.org/2000/svg">' +
                "<script>alert(1)</script>" +
                '<image href="http://attaquant.test/p.png"/></svg>'
        )
    ).toBe(null)
})

/**
 * Fuite de données / SSRF : une référence externe fait sortir une requête vers
 * le serveur d'un tiers au moment du rendu, avec l'IP du lecteur.
 */
test("retire les références externes (image, use, style)", () => {
    const clean = sanitizeSvgText(
        '<svg xmlns="http://www.w3.org/2000/svg">' +
            '<image href="http://attaquant.test/pixel.png"/>' +
            '<use xlink:href="http://attaquant.test/x.svg#a"/>' +
            "<style>@font-face{src:url(http://attaquant.test/f.woff)}</style>" +
            '<path d="M0 0h9v9H0z"/></svg>'
    )
    expect(clean).not.toBe(null)
    expect(clean).not.toContain("attaquant.test")
    expect(clean).toContain("<path")
})

/**
 * XXE et « billion laughs » : la DTD est refusée avant le parse, donc aucune
 * entité n'est jamais expansée.
 */
test("rejette toute DTD (entités externes et récursives)", () => {
    expect(
        sanitizeSvgText(
            '<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>' +
                '<svg xmlns="http://www.w3.org/2000/svg"><text>&xxe;</text></svg>'
        )
    ).toBe(null)

    expect(
        sanitizeSvgText(
            '<!DOCTYPE lol [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;&lol;">]>' +
                '<svg xmlns="http://www.w3.org/2000/svg"><text>&lol2;</text></svg>'
        )
    ).toBe(null)
})

test("rejette un fichier qui n'est pas un SVG", () => {
    expect(sanitizeSvgText("<html><body>pas un svg</body></html>")).toBe(null)
    expect(sanitizeSvgText("nimporte quoi")).toBe(null)
    expect(sanitizeSvgText("<svg><path d=")).toBe(null)
})
