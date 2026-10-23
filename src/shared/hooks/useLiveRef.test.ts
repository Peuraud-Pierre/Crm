// ── useLiveRef.test.ts ────────────────────────────────────────────────────────
// Tests unitaires du pattern "ref miroir synchrone" — factorisé ici après avoir
// été identifié en revue comme dupliqué à l'identique 4 fois dans la feature
// bibliotheque (qrsRef, uiRef, thematiquesRef, dialogRef).

import { describe, expect, test } from "@rstest/core"
import { renderHook } from "@testing-library/react"
import { useLiveRef } from "./useLiveRef"

describe("useLiveRef", () => {
    test("ref.current vaut la valeur initiale au premier rendu", () => {
        const { result } = renderHook(() => useLiveRef("a"))
        expect(result.current.current).toBe("a")
    })

    test("ref.current se met à jour de façon synchrone quand la valeur change entre deux rendus", () => {
        const { result, rerender } = renderHook(({ value }) => useLiveRef(value), {
            initialProps: { value: "a" },
        })
        expect(result.current.current).toBe("a")
        rerender({ value: "b" })
        expect(result.current.current).toBe("b")
    })

    test("l'objet ref retourné reste le MÊME entre deux rendus (identité stable)", () => {
        const { result, rerender } = renderHook(({ value }) => useLiveRef(value), {
            initialProps: { value: 1 },
        })
        const firstRef = result.current
        rerender({ value: 2 })
        expect(result.current).toBe(firstRef)
    })

    test("fonctionne avec des objets et des fonctions, pas seulement des primitives", () => {
        const fnA = () => "a"
        const fnB = () => "b"
        const { result, rerender } = renderHook(({ value }) => useLiveRef(value), {
            initialProps: { value: fnA },
        })
        expect(result.current.current).toBe(fnA)
        rerender({ value: fnB })
        expect(result.current.current).toBe(fnB)
    })
})
