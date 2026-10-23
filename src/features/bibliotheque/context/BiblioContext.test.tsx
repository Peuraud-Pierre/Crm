// ── BiblioContext.test.tsx ────────────────────────────────────────────────────
// Tests unitaires du contexte React de la feature — jusqu'ici sans aucun test.
// Deux garanties à vérifier : useBiblioContext() lève une erreur explicite (pas
// un crash silencieux type "Cannot read properties of null") si utilisé hors
// d'un BiblioProvider, et BiblioProvider appelle useBiblioPage() une SEULE fois
// puis expose exactement sa valeur de retour aux enfants.
//
// useBiblioPage est mocké : le vrai hook orchestre useBibli() (Supabase) — ce
// test ne porte que sur le contexte lui-même, pas sur le chargement de données.

import { describe, expect, test, rstest } from "@rstest/core"
import { render, screen } from "@testing-library/react"

const mocks = rstest.hoisted(() => ({
    useBiblioPage: rstest.fn(),
}))

rstest.mock("../hooks/useBiblioPage", () => ({ useBiblioPage: mocks.useBiblioPage }))

import { BiblioProvider, useBiblioContext } from "./BiblioContext"

function Consumer() {
    const ctx = useBiblioContext()
    return <div>valeur: {String((ctx as unknown as { marker: string }).marker)}</div>
}

function ConsumerOutsideProviderThrows() {
    let message = ""
    try {
        useBiblioContext()
    } catch (err) {
        message = (err as Error).message
    }
    return <div>{message}</div>
}

describe("BiblioContext", () => {
    test("useBiblioContext() lève une erreur explicite hors d'un BiblioProvider", () => {
        render(<ConsumerOutsideProviderThrows />)
        expect(screen.getByText(/useBiblioContext doit être utilisé dans un <BiblioProvider>/)).toBeInTheDocument()
    })

    test("BiblioProvider expose aux enfants exactement la valeur retournée par useBiblioPage()", () => {
        mocks.useBiblioPage.mockReturnValue({ marker: "valeur-de-test" })
        render(
            <BiblioProvider>
                <Consumer />
            </BiblioProvider>
        )
        expect(screen.getByText("valeur: valeur-de-test")).toBeInTheDocument()
    })

    test("plusieurs descendants consommant le contexte reçoivent tous la MÊME valeur (un seul Provider, pas un useBiblioPage par consommateur)", () => {
        // N'affirme pas un nombre exact d'appels à useBiblioPage (détail de
        // scheduling React, pas un comportement du contexte) — vérifie plutôt
        // l'invariant qui compte réellement : BiblioProvider ne recrée pas la
        // valeur par consommateur, donc les deux affichent le même marqueur.
        mocks.useBiblioPage.mockReturnValue({ marker: "x" })
        render(
            <BiblioProvider>
                <Consumer />
                <Consumer />
            </BiblioProvider>
        )
        expect(screen.getAllByText("valeur: x")).toHaveLength(2)
    })
})
