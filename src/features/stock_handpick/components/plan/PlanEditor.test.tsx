import { expect, rstest, test } from "@rstest/core"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { DEFAULT_FLOOR } from "@/features/stock_handpick/utils/floorPlan"
import type { PlanIndex } from "@/features/stock_handpick/utils/planLayout"
import { PlanEditor } from "./PlanEditor"

/**
 * Parcours d'édition du plan : sélectionner un élément, le retirer, annuler,
 * enregistrer. Le glisser à la souris dépend de la géométrie de l'écran,
 * absente de jsdom ; les opérations elles-mêmes sont couvertes par
 * `utils/floorPlanEdit.test.ts`.
 */

const index: PlanIndex = { byPath: new Map(), byZone: new Map() }

function renderEditor(onSave = rstest.fn(), onCancel = rstest.fn()) {
    render(
        <PlanEditor
            initial={DEFAULT_FLOOR}
            saving={false}
            onSave={onSave}
            onCancel={onCancel}
            index={index}
            ballesIn={() => []}
        />,
    )
    return { onSave, onCancel, region: screen.getByRole("region", { name: "Éditeur du plan" }) }
}

/** Zone de saisie d'un élément, retrouvée par son infobulle. */
const hitFor = (title: string) => {
    const node = screen.getAllByText(title, { selector: "title" })
        .map((t) => t.parentElement!)
        .find((el) => el.getAttribute("class")?.includes("cursor-move"))
    if (!node) throw new Error(`Aucune zone de saisie pour « ${title} »`)
    return node
}

test("sans sélection, le panneau explique comment éditer", () => {
    renderEditor()

    expect(screen.getByText("Aucun élément sélectionné")).toBeInTheDocument()
})

test("sélectionner un élément affiche ses propriétés", () => {
    renderEditor()

    fireEvent.pointerDown(hitFor("Bureau 1"))

    expect(screen.getByDisplayValue("Bureau 1")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Retirer/ })).toBeInTheDocument()
})

test("Suppr retire l'élément, Annuler le rétablit, Enregistrer transmet le brouillon", () => {
    const { onSave, region } = renderEditor()

    fireEvent.pointerDown(hitFor("Bureau 2"))
    fireEvent.keyDown(region, { key: "Delete" })
    expect(screen.queryAllByText("Bureau 2", { selector: "title" })).toHaveLength(0)

    fireEvent.click(screen.getByRole("button", { name: /Annuler/ }))
    expect(screen.getAllByText("Bureau 2", { selector: "title" }).length).toBeGreaterThan(0)

    fireEvent.pointerDown(hitFor("Bureau 2"))
    fireEvent.click(screen.getByRole("button", { name: /Retirer/ }))
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer/ }))

    expect(onSave).toHaveBeenCalledTimes(1)
    const saved = onSave.mock.calls[0][0] as typeof DEFAULT_FLOOR
    expect(saved.offices.map((o) => o.id)).toEqual(["bureau-1"])
})

test("une zone ne peut pas être retirée", () => {
    renderEditor()

    const tag = screen.getByText("Zone B")
    fireEvent.pointerDown(tag.parentElement!)

    const panel = screen.getByText("Zone B", { selector: "p" }).closest("div")!.parentElement!
    expect(within(panel).queryByRole("button", { name: /Retirer/ })).not.toBeInTheDocument()
})

test("Quitter abandonne le brouillon", () => {
    const { onCancel, onSave } = renderEditor()

    fireEvent.click(screen.getByRole("button", { name: /Quitter/ }))

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onSave).not.toHaveBeenCalled()
})
