import { expect, test } from "@rstest/core"
import { espacesAccessibles, resolveVue } from "@/features/commandes/utils/commandeVues"

test("espaces selon les droits : entrepôt d'abord, boutique en plus", () => {
    expect(espacesAccessibles(true, false)).toEqual(["entrepot"])
    expect(espacesAccessibles(false, true)).toEqual(["boutique"])
    expect(espacesAccessibles(true, true)).toEqual(["entrepot", "boutique"])
    // Lecture seule : la supervision de l'entrepôt.
    expect(espacesAccessibles(false, false)).toEqual(["entrepot"])
})

test("vue par défaut : la file « à faire » pour l'entrepôt, l'accueil pour la boutique", () => {
    expect(resolveVue(null, ["entrepot", "boutique"])).toBe("a-faire")
    expect(resolveVue(null, ["boutique"])).toBe("accueil")
    expect(resolveVue("n-importe-quoi", ["boutique"])).toBe("accueil")
})

test("une vue d'un espace fermé retombe sur le sien, sans redirection", () => {
    // Lien de notification « livraison expédiée » ouvert par l'entrepôt seul.
    expect(resolveVue("reception", ["entrepot"])).toBe("a-faire")
    expect(resolveVue("livraisons", ["boutique"])).toBe("accueil")
    expect(resolveVue("reception", ["entrepot", "boutique"])).toBe("reception")
    expect(resolveVue("mes-commandes", ["boutique"])).toBe("mes-commandes")
})
