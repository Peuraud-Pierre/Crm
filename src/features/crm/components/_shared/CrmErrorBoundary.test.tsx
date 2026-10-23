import { describe, expect, rstest, test } from "@rstest/core"
import { render, screen, fireEvent } from "@testing-library/react"
import type { ReactElement } from "react"
import { CrmErrorBoundary } from "./CrmErrorBoundary"

rstest.mock("sonner", () => ({ toast: { error: rstest.fn() } }))

function Boom({ shouldThrow }: { shouldThrow: boolean }): ReactElement {
    if (shouldThrow) throw new Error("kaboom")
    return <div>contenu</div>
}

describe("CrmErrorBoundary", () => {
    test("affiche les enfants quand pas d'erreur", () => {
        render(
            <CrmErrorBoundary name="Test">
                <div>ok</div>
            </CrmErrorBoundary>
        )
        expect(screen.getByText("ok")).toBeInTheDocument()
    })

    test("affiche le fallback avec le nom de l'onglet", () => {
        const errSpy = rstest
            .spyOn(console, "error")
            .mockImplementation(() => {})
        render(
            <CrmErrorBoundary name="Calendrier">
                <Boom shouldThrow={true} />
            </CrmErrorBoundary>
        )
        expect(screen.getByText(/Une erreur est survenue/i)).toBeInTheDocument()
        expect(screen.getByText(/Calendrier/)).toBeInTheDocument()
        expect(
            screen.getByRole("button", { name: /Réessayer/i })
        ).toBeInTheDocument()
        // click should not throw
        fireEvent.click(screen.getByRole("button", { name: /Réessayer/i }))
        errSpy.mockRestore()
    })
})
