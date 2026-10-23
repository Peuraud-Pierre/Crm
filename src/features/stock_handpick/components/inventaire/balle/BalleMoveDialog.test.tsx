import { expect, rstest, test } from "@rstest/core"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

/**
 * Déplacement d'une ou plusieurs balles : un chemin incomplet ne valide rien,
 * et retirer de l'emplacement est un choix explicite.
 */

const mocks = rstest.hoisted(() => ({
    useBalleHandpickContext: rstest.fn(() => ({ emplacementOptions: [] })),
}))

rstest.mock("@/features/stock_handpick/hooks/context/StockHandpickProvider", () => ({
    useBalleHandpickContext: mocks.useBalleHandpickContext,
}))

// Le vrai sélecteur descend niveau par niveau : un bouton par issue suffit.
rstest.mock("./EmplacementPicker", () => ({
    EmplacementPicker: ({ onChange }: { onChange: (id: string | null) => void }) => (
        <>
            <button type="button" onClick={() => onChange("e-42")}>Choisir B · R2 · E3 · H1</button>
            <button type="button" onClick={() => onChange(null)}>Chemin incomplet</button>
        </>
    ),
}))

import { BalleMoveDialog } from "./BalleMoveDialog"

function renderDialog(count: number, onConfirm = rstest.fn(async () => true)) {
    render(<BalleMoveDialog open count={count} onClose={rstest.fn()} onConfirm={onConfirm} />)
    return onConfirm
}

test("plusieurs balles : le bouton annonce le nombre et envoie l'emplacement choisi", async () => {
    const onConfirm = renderDialog(5)

    const submit = screen.getByRole("button", { name: "Déplacer 5 balles" })
    expect(submit).toBeDisabled()

    fireEvent.click(screen.getByRole("button", { name: /Choisir B/ }))
    fireEvent.click(submit)

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith("e-42"))
})

test("un chemin incomplet ne permet pas de valider", () => {
    renderDialog(2)

    fireEvent.click(screen.getByRole("button", { name: "Chemin incomplet" }))

    expect(screen.getByRole("button", { name: "Déplacer 2 balles" })).toBeDisabled()
})

test("« Retirer de l'emplacement » envoie null", async () => {
    const onConfirm = renderDialog(1)

    fireEvent.click(screen.getByRole("button", { name: /Retirer de l'emplacement/ }))
    fireEvent.click(screen.getByRole("button", { name: "Déplacer" }))

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(null))
})
