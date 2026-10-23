import { beforeEach, expect, test } from "@rstest/core"
import { act, renderHook } from "@testing-library/react"
import { BOUTIQUE_COURANTE_KEY, useBoutiqueCourante } from "@/features/commandes/hooks/ui/useBoutiqueCourante"
import type { Boutique } from "@/features/commandes/types/commande.types"

const boutique = (id: string, actif = true): Boutique => ({
    id, nom: `Boutique ${id}`, code: id.toUpperCase(), adresse: null, actif, retail_shop_id: null, created_at: "",
})
const LYO = boutique("lyo")
const PAR = boutique("par")

beforeEach(() => localStorage.clear())

test("rien de retenu et plusieurs boutiques : il faut choisir", () => {
    const { result } = renderHook(() => useBoutiqueCourante([LYO, PAR], null))
    expect(result.current.boutique).toBeNull()
})

test("une seule boutique active : prise d'office", () => {
    const { result } = renderHook(() => useBoutiqueCourante([LYO, boutique("old", false)], null))
    expect(result.current.boutique?.id).toBe("lyo")
})

test("le choix est retenu dans ce navigateur", () => {
    const { result } = renderHook(() => useBoutiqueCourante([LYO, PAR], null))
    act(() => result.current.choisir("par"))
    expect(result.current.boutique?.id).toBe("par")
    expect(localStorage.getItem(BOUTIQUE_COURANTE_KEY)).toBe("par")

    const relu = renderHook(() => useBoutiqueCourante([LYO, PAR], null))
    expect(relu.result.current.boutique?.id).toBe("par")
})

test("un lien profond impose sa boutique et devient le choix retenu", () => {
    localStorage.setItem(BOUTIQUE_COURANTE_KEY, "lyo")
    const { result } = renderHook(() => useBoutiqueCourante([LYO, PAR], "par"))
    expect(result.current.boutique?.id).toBe("par")
    expect(localStorage.getItem(BOUTIQUE_COURANTE_KEY)).toBe("par")
})

test("une boutique retenue puis désactivée est ignorée", () => {
    localStorage.setItem(BOUTIQUE_COURANTE_KEY, "par")
    const { result } = renderHook(() => useBoutiqueCourante([LYO, boutique("par", false), boutique("mrs")], null))
    expect(result.current.boutique).toBeNull()
    expect(result.current.actives.map((b) => b.id)).toEqual(["lyo", "mrs"])
})
