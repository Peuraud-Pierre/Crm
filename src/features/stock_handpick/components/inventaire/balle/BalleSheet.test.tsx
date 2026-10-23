import { expect, rstest, test } from "@rstest/core"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { BalleHandpick } from "@/features/stock_handpick/types/balle.types"

/**
 * Formulaire d'une balle — ce que sa saisie doit garantir.
 *
 * `balles_handpick` est publiée en realtime : toute écriture sur l'inventaire
 * reconstruit la liste, donc un nouvel objet pour la balle ouverte. Le
 * brouillon se réamorçait sur cet objet et la saisie en cours repartait à la
 * valeur du serveur. Même garantie que `FluxSheet`.
 */

// Le formulaire réel lit deux contextes : un champ suffit à observer le brouillon.
rstest.mock("./BalleForm", () => ({
    EMPTY_BALLE_FORM: { raw_name: null },
    BalleForm: ({
        value,
        onChange,
        lotLines,
    }: {
        value: { raw_name: string | null }
        onChange: (next: { raw_name: string | null }) => void
        lotLines?: React.ReactNode
    }) => (
        <>
            <input
                aria-label="Libellé"
                value={value.raw_name ?? ""}
                onChange={(event) => onChange({ ...value, raw_name: event.target.value })}
            />
            {lotLines}
        </>
    ),
}))

// Les lignes réelles lisent les contextes : un bouton suffit à en ajouter.
rstest.mock("./BalleLotLines", () => ({
    BalleLotLines: ({
        lines,
        onChange,
    }: {
        lines: { key: string }[]
        onChange: (next: { key: string }[]) => void
    }) => (
        <button type="button" onClick={() => onChange([...lines, { ...lines[0], key: `k${lines.length}` }])}>
            Ajouter une balle
        </button>
    ),
}))

import { BalleSheet } from "./BalleSheet"

function balle(over: Partial<BalleHandpick> = {}): BalleHandpick {
    return {
        id: "b1",
        raw_name: "Serveur",
        ...over,
    } as BalleHandpick
}

function sheet(row: BalleHandpick | null, over: Partial<Parameters<typeof BalleSheet>[0]> = {}) {
    return (
        <BalleSheet
            open
            balle={row}
            canDelete={false}
            onClose={() => {}}
            onSubmit={async () => true}
            onCreateMany={async () => true}
            {...over}
        />
    )
}

const libelle = () => screen.getByLabelText("Libellé") as HTMLInputElement

test("un refetch de la même balle n'écrase pas la saisie en cours", () => {
    const { rerender } = render(sheet(balle()))

    fireEvent.change(libelle(), { target: { value: "Saisie en cours" } })
    // Même balle, objet reconstruit par le refetch qui suit une salve realtime.
    rerender(sheet(balle()))

    expect(libelle().value).toBe("Saisie en cours")
})

test("ouvrir une autre balle réamorce le brouillon", () => {
    const { rerender } = render(sheet(balle()))

    fireEvent.change(libelle(), { target: { value: "Saisie en cours" } })
    rerender(sheet(balle({ id: "b2", raw_name: "Autre" })))

    expect(libelle().value).toBe("Autre")
})

test("une écriture refusée garde la sheet ouverte", async () => {
    const onClose = rstest.fn()
    const onSubmit = rstest.fn(async () => false)
    render(sheet(balle(), { onSubmit, onClose }))

    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    await waitFor(() =>
        expect(screen.getByRole("button", { name: "Enregistrer" })).not.toBeDisabled(),
    )
    expect(onClose).not.toHaveBeenCalled()
})

test("en création, le bouton annonce le nombre de balles et crée tout le lot", async () => {
    const onCreateMany = rstest.fn(async () => true)
    render(sheet(null, { onCreateMany }))

    expect(screen.getByRole("button", { name: "Créer la balle" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Ajouter une balle" }))
    fireEvent.click(screen.getByRole("button", { name: "Créer 2 balles" }))

    await waitFor(() => expect(onCreateMany).toHaveBeenCalledTimes(1))
    expect(onCreateMany.mock.calls[0][0]).toHaveLength(2)
})

test("l'édition reste à une balle, sans lignes de lot", () => {
    render(sheet(balle()))

    expect(screen.queryByRole("button", { name: "Ajouter une balle" })).toBeNull()
})
