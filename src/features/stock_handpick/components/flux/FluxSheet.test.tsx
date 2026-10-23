import { expect, rstest, test } from "@rstest/core"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { FluxHandpickRow } from "@/features/stock_handpick/types/flux.types"

/**
 * Formulaire de l'en-tête d'une expédition — ce que sa saisie doit garantir.
 *
 * Le module émet une salve realtime à chaque écriture sur les flux ET sur les
 * lignes de colisage. Chaque salve reconstruit la liste côté client, donc
 * l'objet passé en `flux` change d'identité sans que l'expédition ouverte
 * change. Le brouillon était réamorcé dessus : la saisie en cours repartait à
 * la valeur du serveur.
 *
 * La liste de colisage a depuis été déplacée dans `FluxDetailSheet`, ce qui
 * retire la source la plus fréquente de ces salves — mais pas toutes : une
 * écriture sur l'en-tête en produit une aussi. Les garanties ci-dessous restent
 * donc nécessaires.
 */

const mocks = rstest.hoisted(() => ({ referential: rstest.fn() }))

rstest.mock("@/features/stock_handpick/hooks/context/StockHandpickProvider", () => ({
    useReferentialHandpickContext: mocks.referential,
}))

import { FluxSheet } from "./FluxSheet"

mocks.referential.mockReturnValue({ fournisseurs: [] })

function flux(over: Partial<FluxHandpickRow> = {}): FluxHandpickRow {
    return {
        id: "f1",
        direction: "in",
        status: "planifié",
        fournisseur_id: null,
        type: null,
        poids_kg: null,
        fournisseur: null,
        departure_date: "2026-09-01",
        prev_dechargement_at: "2026-09-15T08:00:00+00:00",
        notes: null,
        created_at: "2026-09-01T00:00:00Z",
        updated_at: "2026-09-01T00:00:00Z",
        created_by: null,
        lignes_count: 0,
        total_weight_kg: 0,
        total_qty: 0,
        total_value: 0,
        ...over,
    } as FluxHandpickRow
}

function sheet(
    row: FluxHandpickRow | null,
    over: Partial<Parameters<typeof FluxSheet>[0]> = {},
) {
    return (
        <FluxSheet
            open
            flux={row}
            defaultDirection="in"
            canCreate
            canUpdate
            canDelete={false}
            onClose={() => {}}
            onSubmit={async () => true}
            {...over}
        />
    )
}

const dechargement = () =>
    screen.getByLabelText("Déchargement prévu") as HTMLInputElement

test("le déchargement enregistré remplit le champ à l'ouverture", () => {
    render(sheet(flux()))

    // Heure locale : la valeur stockée est en UTC, le champ n'a pas de fuseau.
    const expected = new Date("2026-09-15T08:00:00+00:00")
    const pad = (n: number) => String(n).padStart(2, "0")
    expect(dechargement().value).toBe(
        `${expected.getFullYear()}-${pad(expected.getMonth() + 1)}-${pad(expected.getDate())}` +
            `T${pad(expected.getHours())}:${pad(expected.getMinutes())}`,
    )
})

test("un horodatage illisible vide le champ plutôt que d'y écrire NaN", () => {
    render(sheet(flux({ prev_dechargement_at: "pas une date" })))

    expect(dechargement().value).toBe("")
})

test("un refetch de la même expédition n'écrase pas la saisie en cours", () => {
    const { rerender } = render(sheet(flux()))

    fireEvent.change(dechargement(), { target: { value: "2026-10-02T14:30" } })
    expect(dechargement().value).toBe("2026-10-02T14:30")

    // Même expédition, objet reconstruit par le refetch qui suit la salve.
    rerender(sheet(flux()))

    expect(dechargement().value).toBe("2026-10-02T14:30")
})

test("refermer puis rouvrir la même expédition oublie la saisie abandonnée", () => {
    const { rerender } = render(sheet(flux()))

    fireEvent.change(dechargement(), { target: { value: "2026-10-02T14:30" } })
    rerender(sheet(flux(), { open: false }))
    rerender(sheet(flux()))

    expect(dechargement().value).not.toBe("2026-10-02T14:30")
})

// ─── Droits ───────────────────────────────────────────────────────────────────

test("le droit de création suffit pour créer, sans le droit de modification", () => {
    // Régression : la création était gatée sur `canUpdate`. Un compte qui n'a
    // que `flux.create` obtenait un formulaire grisé, sans bouton Créer.
    render(sheet(null, { canCreate: true, canUpdate: false }))

    expect(screen.getByRole("button", { name: "Créer" })).toBeInTheDocument()
    expect(dechargement()).not.toBeDisabled()
})

test("sans le droit de modification, une expédition existante reste en lecture", () => {
    render(sheet(flux(), { canCreate: true, canUpdate: false }))

    expect(screen.queryByRole("button", { name: "Enregistrer" })).not.toBeInTheDocument()
    expect(dechargement()).toBeDisabled()
})

// ─── Échec d'écriture ─────────────────────────────────────────────────────────

test("une écriture refusée garde la sheet ouverte", async () => {
    // Régression : la sheet se refermait sans condition après `onSubmit`, et
    // un refus de la base (nom déjà utilisé, RLS) faisait perdre la saisie.
    const onClose = rstest.fn()
    const onSubmit = rstest.fn(async () => false)
    render(sheet(null, { onSubmit, onClose }))

    fireEvent.click(screen.getByRole("button", { name: "Créer" }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByRole("button", { name: "Créer" })).not.toBeDisabled())
    expect(onClose).not.toHaveBeenCalled()
})

test("une écriture aboutie referme la sheet", async () => {
    const onClose = rstest.fn()
    render(sheet(null, { onSubmit: async () => true, onClose }))

    fireEvent.click(screen.getByRole("button", { name: "Créer" }))

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
})

test("ouvrir une autre expédition réamorce le brouillon", () => {
    const { rerender } = render(sheet(flux()))

    fireEvent.change(dechargement(), { target: { value: "2026-10-02T14:30" } })
    rerender(sheet(flux({ id: "f2", prev_dechargement_at: null })))

    expect(dechargement().value).toBe("")
})
