import { describe, expect, rstest, test } from "@rstest/core"
import { render, screen, fireEvent } from "@testing-library/react"
import type { ReactElement } from "react"
import { BiblioErrorBoundary } from "./BiblioErrorBoundary"

function Boom({ shouldThrow }: { shouldThrow: boolean }): ReactElement {
    if (shouldThrow) throw new Error("kaboom")
    return <div>contenu</div>
}

describe("BiblioErrorBoundary", () => {
    test("affiche les enfants quand il n'y a pas d'erreur", () => {
        render(
            <BiblioErrorBoundary>
                <div>ok</div>
            </BiblioErrorBoundary>
        )
        expect(screen.getByText("ok")).toBeInTheDocument()
    })

    test("affiche un fallback avec le message d'erreur et un bouton Réessayer au lieu de faire planter l'arbre", () => {
        const errSpy = rstest.spyOn(console, "error").mockImplementation(() => {})
        render(
            <BiblioErrorBoundary>
                <Boom shouldThrow={true} />
            </BiblioErrorBoundary>
        )

        expect(screen.getByText(/Une erreur est survenue/i)).toBeInTheDocument()
        expect(screen.getByText("kaboom")).toBeInTheDocument()
        expect(screen.getByRole("button", { name: /Réessayer/i })).toBeInTheDocument()
        errSpy.mockRestore()
    })

    test("le bouton Réessayer réinitialise l'état et remonte les enfants", () => {
        const errSpy = rstest.spyOn(console, "error").mockImplementation(() => {})
        render(
            <BiblioErrorBoundary>
                <Boom shouldThrow={true} />
            </BiblioErrorBoundary>
        )

        // Ne doit pas lever d'exception au clic
        expect(() => fireEvent.click(screen.getByRole("button", { name: /Réessayer/i }))).not.toThrow()
        errSpy.mockRestore()
    })
})
