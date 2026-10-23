import { beforeEach, expect, rstest, test } from "@rstest/core"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { FLUX_MONTHS_PER_PAGE } from "@/features/stock_handpick/constants"
import type { FluxHandpickRow } from "@/features/stock_handpick/types/flux.types"
import { FluxTable } from "./FluxTable"

/**
 * Le tableau des expéditions est le point central du déploiement du module : il
 * doit se lire exactement comme celui des arrivages du stock principal. Ce
 * fichier fixe cette parité — mêmes colonnes, mêmes bannières de mois, mêmes
 * alertes, même page d'ouverture.
 */

/** Le 15 du mois situé `k` mois dans le futur — voir le test jumeau côté stock. */
function monthsAhead(k: number): string {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth() + k, 15, 12, 0, 0).toISOString()
}

function daysAhead(k: number): string {
    return new Date(Date.now() + k * 24 * 60 * 60 * 1000).toISOString()
}

let seq = 0

function flux(over: Partial<FluxHandpickRow> = {}): FluxHandpickRow {
    seq += 1
    return {
        id: `flux-${seq}`,
        direction: "in",
        status: "planifié",
        fournisseur_id: "f1",
        type: null,
        poids_kg: null,
        fournisseur: { id: "f1", name: "Fournisseur Un" },
        departure_date: null,
        prev_dechargement_at: null,
        notes: null,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        created_by: null,
        lignes_count: 3,
        total_weight_kg: 1000,
        total_qty: 0,
        total_value: 0,
        ...over,
    }
}

const renderTable = (
    rows: FluxHandpickRow[] | undefined,
    onOpen = rstest.fn(),
    { canUpdate = true, onEdit = rstest.fn() } = {},
) =>
    render(
        <FluxTable
            rows={rows}
            canUpdate={canUpdate}
            onOpen={onOpen}
            onEdit={onEdit}
            emptyLabel="Aucun arrivage"
            emptyDescription="Les conteneurs reçus apparaîtront dans ce tableau."
        />,
    )

const dataRows = (container: HTMLElement) =>
    [...container.querySelectorAll("tbody tr")].filter((tr) =>
        tr.className.includes("border-l-"),
    )

beforeEach(() => {
    rstest.clearAllMocks()
    seq = 0
})

// ─── Colonnes ─────────────────────────────────────────────────────────────────

test("les colonnes suivent celles de l'en-tête", () => {
    renderTable([flux({ prev_dechargement_at: monthsAhead(1) })])

    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent?.trim())
    expect(headers).toEqual([
        "Statut",
        "Usine",
        "Type",
        "Départ",
        "Déchargement",
        "Poids (kg)",
        "Quantité",
        "",
    ])
})

test("les totaux absents s'affichent en tiret et non en zéro", () => {
    const { container } = renderTable([
        flux({ prev_dechargement_at: monthsAhead(1), total_weight_kg: 0, total_qty: 0 }),
    ])

    const [row] = dataRows(container)
    expect(row.textContent).toContain("—")
})

// ─── Bannière de mois ─────────────────────────────────────────────────────────

test("la bannière porte le compte et le poids total du mois", () => {
    const at = monthsAhead(1)
    renderTable([
        flux({ prev_dechargement_at: at, total_weight_kg: 1200 }),
        flux({ prev_dechargement_at: at, total_weight_kg: 800 }),
    ])

    expect(screen.getByText("(2 expéditions)")).toBeInTheDocument()
    expect(
        screen.getAllByText((_, el) => el?.textContent?.replace(/\s/g, "") === "2000kg"),
    ).not.toHaveLength(0)
})

test("une expédition seule reste au singulier", () => {
    renderTable([flux({ prev_dechargement_at: monthsAhead(1) })])

    expect(screen.getByText("(1 expédition)")).toBeInTheDocument()
})

// ─── Teintes de ligne ─────────────────────────────────────────────────────────

test("une prochaine expédition est en ambre", () => {
    const { container } = renderTable([flux({ prev_dechargement_at: daysAhead(2) })])

    const [row] = dataRows(container)
    expect(row.className).toContain("border-l-amber-400")
})

// ─── Pagination par mois ──────────────────────────────────────────────────────

test("une page affiche au plus FLUX_MONTHS_PER_PAGE mois", () => {
    renderTable([1, 2, 3, 4, 5].map((k) => flux({ prev_dechargement_at: monthsAhead(k) })))

    expect(screen.getAllByText("(1 expédition)")).toHaveLength(FLUX_MONTHS_PER_PAGE)
})

test("la page initiale est celle des prochaines expéditions", () => {
    // Même construction que le test jumeau du stock : 8 mois futurs, les 5
    // échéances les plus proches tombent dans les derniers groupes.
    renderTable([1, 2, 3, 4, 5, 6, 7, 8].map((k) => flux({ prev_dechargement_at: monthsAhead(k) })))

    expect(screen.getByRole("button", { current: "page" })).toHaveTextContent("2")
})

// ─── Ouverture ────────────────────────────────────────────────────────────────

test("cliquer une ligne ouvre l'expédition", async () => {
    const onOpen = rstest.fn()
    const target = flux({ prev_dechargement_at: monthsAhead(1) })
    const { container } = renderTable([target], onOpen)

    await userEvent.setup({ pointerEventsCheck: 0 }).click(dataRows(container)[0])

    expect(onOpen).toHaveBeenCalledWith(target)
})

test("avec le droit de modification, le crayon saute au formulaire", async () => {
    // Raccourci : corriger un n° de conteneur ne doit pas coûter deux écrans.
    const onOpen = rstest.fn()
    const onEdit = rstest.fn()
    const target = flux({ prev_dechargement_at: monthsAhead(1) })
    renderTable([target], onOpen, { onEdit })

    await userEvent
        .setup({ pointerEventsCheck: 0 })
        .click(screen.getByRole("button", { name: /Modifier l'expédition/ }))

    expect(onEdit).toHaveBeenCalledWith(target)
    // La ligne entière est cliquable : sans `stopPropagation`, le clic sur le
    // bouton ouvrirait aussi la fiche de lecture.
    expect(onOpen).not.toHaveBeenCalled()
})

test("sans le droit de modification, le bouton devient un œil vers la fiche", async () => {
    // Le bouton n'est pas masqué : une ligne de tableau n'est pas focusable,
    // c'est le seul point d'entrée accessible au clavier — et c'est par la
    // fiche que se consulte la liste de colisage.
    const onOpen = rstest.fn()
    const onEdit = rstest.fn()
    const target = flux({ prev_dechargement_at: monthsAhead(1) })
    renderTable([target], onOpen, { canUpdate: false, onEdit })

    await userEvent
        .setup({ pointerEventsCheck: 0 })
        .click(screen.getByRole("button", { name: /Voir l'expédition/ }))

    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(onEdit).not.toHaveBeenCalled()
})

// ─── États de bord ────────────────────────────────────────────────────────────

test("rows indéfinies : squelette annoncé", () => {
    renderTable(undefined)

    expect(screen.getByRole("status", { name: /Chargement des expéditions/ })).toBeInTheDocument()
})

test("rows vides : état vide", () => {
    renderTable([])

    expect(screen.getByText("Aucun arrivage")).toBeInTheDocument()
})
