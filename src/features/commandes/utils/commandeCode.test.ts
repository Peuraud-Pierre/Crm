import { expect, test } from "@rstest/core"
import {
    canonicalCartonCode,
    formatCartonCode,
    formatCommandeCode,
    formatLivraisonCode,
    formatPaletteCode,
    parseCartonCode,
} from "@/features/commandes/utils/commandeCode"

test("formats alignés sur la base (v_cartons, code_livraison)", () => {
    expect(formatCommandeCode(17)).toBe("CMD-0017")
    expect(formatLivraisonCode(42)).toBe("LIV-0042")
    expect(formatPaletteCode(42, 2)).toBe("LIV-0042-P2")
    expect(formatCartonCode(42, 7)).toBe("LIV-0042-C07")
    expect(formatCartonCode(12345, 123)).toBe("LIV-12345-C123")
})

test("un code de carton se relit, même mal tapé", () => {
    for (const raw of ["LIV-0042-C07", "liv-0042-c07", " LIV 42 C7 ", "LIV0042C07", "liv_42_c007"]) {
        expect(parseCartonCode(raw)).toEqual({ livraisonNumero: 42, cartonNumero: 7 })
    }
    expect(canonicalCartonCode("liv 42 c7")).toBe("LIV-0042-C07")
})

test("ce qui n'est pas un carton est refusé", () => {
    expect(parseCartonCode("LIV-0042-P2")).toBeNull()
    expect(parseCartonCode("LIV-0042")).toBeNull()
    expect(parseCartonCode("3900001320848")).toBeNull()
    expect(parseCartonCode("LIV-0000-C01")).toBeNull()
    expect(parseCartonCode("https://a.fr/stock-handpick/codes/3f2b8c1e")).toBeNull()
})
