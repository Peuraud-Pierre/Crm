// ── FormatToggleButton.test.tsx ───────────────────────────────────────────────
// Tests unitaires de FormatToggleButton — composant pur (aucun contexte), mais
// jusqu'ici sans test alors qu'il porte le seul bouton partagé entre QRCard et
// QRDetailPanel (voir son en-tête) : une régression ici les affecterait
// silencieusement toutes les deux à la fois.

import { describe, expect, test, rstest } from "@rstest/core"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { FormatToggleButton } from "./FormatToggleButton"

describe("FormatToggleButton", () => {
    test("affiche le label passé en prop", () => {
        render(<FormatToggleButton onClick={rstest.fn()} label="Formats Réponses" />)
        expect(screen.getByText("Formats Réponses")).toBeInTheDocument()
    })

    test("appelle onClick au clic", async () => {
        const user = userEvent.setup()
        const onClick = rstest.fn()
        render(<FormatToggleButton onClick={onClick} label="Formats" />)
        await user.click(screen.getByRole("button"))
        expect(onClick).toHaveBeenCalledTimes(1)
    })
})
