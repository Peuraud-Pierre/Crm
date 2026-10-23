import { beforeEach, expect, rstest, test } from "@rstest/core"
import { fireEvent, render, screen } from "@testing-library/react"

/**
 * Usine et catégorie — deux choix indépendants depuis que les usines ne
 * déclarent plus de « catégories proposées ». Une valeur déjà retenue
 * (usine ou catégorie désactivée) reste proposée plutôt qu'effacée.
 */

const mocks = rstest.hoisted(() => ({ referential: rstest.fn() }))

rstest.mock("@/features/stock_handpick/hooks/context/StockHandpickProvider", () => ({
    useReferentialHandpickContext: mocks.referential,
}))

// Un <select> natif à la place de la liste à recherche : on observe les
// options proposées et les valeurs émises, pas le dessin du popover.
rstest.mock("@/shared/ui/molecules/search-select", () => ({
    SearchSelect: ({
        label,
        options,
        value,
        onChange,
    }: {
        label: string
        options: { value: string; label: string }[]
        value: string
        onChange: (next: string) => void
    }) => (
        <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
            <option value="">—</option>
            {options.map((option) => (
                <option key={option.value} value={option.value}>
                    {option.label}
                </option>
            ))}
        </select>
    ),
}))

import { BalleFournisseurCategorySelects } from "./BalleFournisseurCategorySelects"

const CATEGORIES = [
    { id: "c1", name: "Un", tag: null, is_active: true },
    { id: "c2", name: "Deux", tag: null, is_active: true },
    { id: "c3", name: "Trois", tag: null, is_active: false },
]

beforeEach(() => {
    rstest.clearAllMocks()
    mocks.referential.mockReturnValue({
        fournisseurs: [
            { id: "f1", name: "F1", is_active: true },
            { id: "f2", name: "F2", is_active: false },
        ],
        categories: CATEGORIES,
    })
})

function renderSelects(fournisseurId: string | null, categoryId: string | null) {
    const onFournisseurChange = rstest.fn()
    const onCategoryChange = rstest.fn()
    render(
        <BalleFournisseurCategorySelects
            fournisseurId={fournisseurId}
            categoryId={categoryId}
            onFournisseurChange={onFournisseurChange}
            onCategoryChange={onCategoryChange}
        />,
    )
    return { onFournisseurChange, onCategoryChange }
}

const optionNames = (label: string) =>
    [...(screen.getByLabelText(label) as HTMLSelectElement).options].map((o) => o.text)

test("toutes les catégories actives sont proposées, sans usine choisie", () => {
    renderSelects(null, null)

    expect(optionNames("Catégorie")).toEqual(["—", "Un", "Deux"])
})

test("changer d'usine ne touche pas à la catégorie", () => {
    const { onFournisseurChange, onCategoryChange } = renderSelects("f1", "c1")

    fireEvent.change(screen.getByLabelText("Usine"), { target: { value: "" } })

    expect(onFournisseurChange).toHaveBeenCalledWith(null)
    expect(onCategoryChange).not.toHaveBeenCalled()
})

test("une catégorie désactivée déjà retenue reste proposée", () => {
    renderSelects("f1", "c3")

    expect(optionNames("Catégorie")).toContain("Trois (inactive)")
    expect((screen.getByLabelText("Catégorie") as HTMLSelectElement).value).toBe("c3")
})

test("une usine désactivée n'est proposée que si elle est déjà retenue", () => {
    renderSelects(null, null)
    expect(optionNames("Usine")).toEqual(["—", "F1"])
})
