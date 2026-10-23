import { beforeEach, expect, rstest, test } from "@rstest/core"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { MemoryRouter, Route, Routes, useParams } from "react-router"
import type { FluxHandpickRow } from "@/features/stock_handpick/types/flux.types"

/**
 * La bascule Arrivages / Départs est la navigation principale de l'onglet : un
 * seul tableau est monté à la fois, et c'est elle qui décide lequel. Ce fichier
 * fixe ce qu'elle doit garantir — le bon jeu de lignes, le bon libellé d'action,
 * et le retour sur le bon tableau quand un lien profond vise l'autre sens.
 */

const mocks = rstest.hoisted(() => {
    const hasPermission = rstest.fn(() => true)
    const context = rstest.fn()
    return { hasPermission, useAuth: rstest.fn(() => ({ hasPermission })), context }
})

rstest.mock("@/features/auth/hooks/useAuth/AuthProvider", () => ({
    useAuth: mocks.useAuth,
}))

rstest.mock("@/features/stock_handpick/hooks/context/StockHandpickProvider", () => ({
    useFluxHandpickContext: mocks.context,
}))

// Sondes : le tableau et la fiche ont chacun leur fichier de test. Ici on
// n'observe que ce que l'onglet leur transmet.
rstest.mock("./FluxTable", () => ({
    FluxTable: ({
        rows,
        emptyLabel,
        onEdit,
    }: {
        rows?: { id: string }[]
        emptyLabel: string
        onEdit: (row: { id: string }) => void
    }) => (
        <div data-testid="table" data-empty={emptyLabel}>
            {(rows ?? []).map((row) => (
                <span key={row.id} data-testid="row">
                    {row.id}
                </span>
            ))}
            <button type="button" onClick={() => onEdit({ id: "in-1" })}>
                Crayon
            </button>
        </div>
    ),
}))
rstest.mock("./FluxSheet", () => ({
    FluxSheet: ({
        open,
        defaultDirection,
        onClose,
        onSubmit,
    }: {
        open: boolean
        defaultDirection: string
        onClose: () => void
        onSubmit: (payload: { direction: string }) => Promise<boolean>
    }) =>
        open ? (
            <div data-testid="sheet" data-direction={defaultDirection}>
                <button type="button" onClick={onClose}>
                    Fermer le formulaire
                </button>
                <button type="button" onClick={() => onSubmit({ direction: "in" })}>
                    Soumettre
                </button>
            </div>
        ) : null,
}))
rstest.mock("./FluxDetailSheet", () => ({
    FluxDetailSheet: ({
        open,
        flux: row,
        onEdit,
    }: {
        open: boolean
        flux?: { direction: string } | null
        onEdit?: () => void
    }) =>
        open ? (
            <div data-testid="detail-sheet" data-direction={row?.direction}>
                {onEdit && (
                    <button type="button" onClick={onEdit}>
                        Modifier
                    </button>
                )}
            </div>
        ) : null,
}))

import FluxTab from "./FluxTab"

let seq = 0

function flux(direction: "in" | "out"): FluxHandpickRow {
    seq += 1
    return {
        id: `${direction}-${seq}`,
        direction,
        status: "planifié",
        fournisseur_id: null,
        type: null,
        poids_kg: null,
        fournisseur: null,
        departure_date: null,
        prev_dechargement_at: null,
        notes: null,
        created_at: "2026-03-01T00:00:00.000Z",
        updated_at: "2026-03-01T00:00:00.000Z",
        created_by: null,
        lignes_count: 0,
        total_weight_kg: 0,
        total_qty: 0,
        total_value: 0,
    }
}

const ARRIVAGES = [flux("in"), flux("in")]
const DEPARTS = [flux("out")]

function setContext(over: Record<string, unknown> = {}) {
    const all = [...ARRIVAGES, ...DEPARTS]
    mocks.context.mockReturnValue({
        flux: all,
        filteredFor: (d: "in" | "out") => all.filter((row) => row.direction === d),
        loading: false,
        hasMore: false,
        loadMore: rstest.fn(),
        total: all.length,
        filters: {
            status: "all", fournisseur_id: "all",
            dateFrom: null, dateTo: null, search: "",
        },
        setFilters: rstest.fn(),
        resetFilters: rstest.fn(),
        hasActiveFilters: false,
        findById: (id: string) => all.find((row) => row.id === id) ?? null,
        createFlux: rstest.fn(),
        updateFlux: rstest.fn(),
        removeFlux: rstest.fn(),
        ...over,
    })
}

function renderAt(path = "/stock-handpick/flux") {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route
                    path="/stock-handpick/flux/:detail?"
                    element={<FluxTabWithDetail />}
                />
            </Routes>
        </MemoryRouter>,
    )
}

/**
 * En usage réel, `detail` vient de `TabbedModuleRoute`, qui le tire de l'URL.
 * On le relaie ici depuis les paramètres de route — et non de
 * `window.location`, que `MemoryRouter` ne touche pas.
 */
function FluxTabWithDetail() {
    const { detail } = useParams()
    return <FluxTab detail={detail} />
}

const toggle = (name: RegExp) => screen.getByRole("button", { name })
const rows = () => within(screen.getByTestId("table")).queryAllByTestId("row")

beforeEach(() => {
    rstest.clearAllMocks()
    mocks.hasPermission.mockReturnValue(true)
    setContext()
})

// ─── Bascule ──────────────────────────────────────────────────────────────────

test("les arrivages sont affichés par défaut", () => {
    renderAt()

    expect(rows().map((r) => r.textContent)).toEqual(["in-1", "in-2"])
})

test("basculer sur Départs change le jeu de lignes", () => {
    renderAt()

    fireEvent.click(toggle(/Départs/))

    expect(rows().map((r) => r.textContent)).toEqual(["out-3"])
})

test("un seul tableau est monté à la fois", () => {
    renderAt()

    expect(screen.getAllByTestId("table")).toHaveLength(1)
})

test("la bascule annonce le nombre de lignes de chaque sens", () => {
    renderAt()

    expect(toggle(/Arrivages/)).toHaveTextContent("2")
    expect(toggle(/Départs/)).toHaveTextContent("1")
})

test("l'état actif est porté par la bascule, pour les lecteurs d'écran", () => {
    renderAt()

    expect(toggle(/Arrivages/)).toHaveAttribute("aria-pressed", "true")
    expect(toggle(/Départs/)).toHaveAttribute("aria-pressed", "false")

    fireEvent.click(toggle(/Départs/))

    expect(toggle(/Départs/)).toHaveAttribute("aria-pressed", "true")
})

// ─── Ce qui suit la bascule ───────────────────────────────────────────────────

test("l'action de création suit le sens affiché", () => {
    renderAt()
    expect(screen.getByRole("button", { name: /Nouvel arrivage/ })).toBeInTheDocument()

    fireEvent.click(toggle(/Départs/))

    expect(screen.getByRole("button", { name: /Nouveau départ/ })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Nouvel arrivage/ })).not.toBeInTheDocument()
})

test("l'état vide nomme le sens affiché", () => {
    setContext({ filteredFor: () => [] })
    renderAt()

    expect(screen.getByTestId("table")).toHaveAttribute("data-empty", "Aucun arrivage")

    fireEvent.click(toggle(/Départs/))

    expect(screen.getByTestId("table")).toHaveAttribute("data-empty", "Aucun départ")
})

test("sans droit de création, aucun bouton d'ajout", () => {
    mocks.hasPermission.mockReturnValue(false)
    renderAt()

    expect(screen.queryByRole("button", { name: /Nouvel arrivage/ })).not.toBeInTheDocument()
})

// ─── Lien profond ─────────────────────────────────────────────────────────────

test("un lien vers un départ bascule sur le tableau qui le contient", () => {
    // Sans cette resynchronisation, la fiche s'ouvrirait au-dessus des
    // arrivages, et la refermer ne montrerait pas l'expédition consultée.
    renderAt("/stock-handpick/flux/out-3")

    expect(screen.getByTestId("detail-sheet")).toHaveAttribute("data-direction", "out")
    expect(toggle(/Départs/)).toHaveAttribute("aria-pressed", "true")
    expect(rows().map((r) => r.textContent)).toEqual(["out-3"])
})

test("un lien profond ouvre la fiche de lecture, pas le formulaire", () => {
    // Remplace l'ancienne assertion, qui attendait `sheet` sur un lien profond :
    // l'URL adresse l'expédition, et c'est la FICHE qui la montre.
    renderAt("/stock-handpick/flux/in-1")

    expect(screen.getByTestId("detail-sheet")).toBeInTheDocument()
    expect(screen.queryByTestId("sheet")).not.toBeInTheDocument()
})

test("avec le seul droit de lecture, la fiche s'ouvre sans proposer de modifier", () => {
    // C'est ce que le contournement `canUpdate: true` de la garde de lien
    // profond remplaçait : il ouvrait à ce compte un formulaire que la RLS
    // aurait refusé, faute de fiche de lecture où consulter le colisage.
    mocks.hasPermission.mockImplementation(
        (key: string) => key === "stock_handpick.flux.view",
    )
    renderAt("/stock-handpick/flux/in-1")

    expect(screen.getByTestId("detail-sheet")).toBeInTheDocument()
    expect(screen.queryByTestId("sheet")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Modifier" })).not.toBeInTheDocument()
})

test("sans aucun droit de consultation, le lien profond retombe sur la liste", () => {
    mocks.hasPermission.mockReturnValue(false)
    renderAt("/stock-handpick/flux/in-1")

    expect(screen.queryByTestId("detail-sheet")).not.toBeInTheDocument()
    expect(screen.queryByTestId("sheet")).not.toBeInTheDocument()
})

test("un lien vers une expédition hors du palier chargé ouvre quand même sa fiche", async () => {
    // Régression : la garde ne cherchait que dans le palier et nettoyait l'URL
    // comme un lien mort — la fiche d'une balle ne menait nulle part.
    const ancienne = { ...flux("out"), id: "ancienne-1" }
    const fetchById = rstest.fn(async () => ancienne)
    setContext({ fetchById })

    renderAt("/stock-handpick/flux/ancienne-1")

    expect(await screen.findByTestId("detail-sheet")).toHaveAttribute("data-direction", "out")
    expect(fetchById).toHaveBeenCalledWith("ancienne-1")
})

test("un identifiant introuvable, même à l'unité, retombe sur la liste", async () => {
    const fetchById = rstest.fn(async () => null)
    setContext({ fetchById })

    renderAt("/stock-handpick/flux/fantome")

    await waitFor(() => expect(fetchById).toHaveBeenCalledWith("fantome"))
    expect(screen.queryByTestId("detail-sheet")).not.toBeInTheDocument()
})

test("le crayon du tableau ouvre le formulaire sans passer par la fiche", () => {
    // Raccourci : `openEdit` pose le drapeau d'édition AVANT de naviguer, sinon
    // l'URL ouvrirait la fiche de lecture et le crayon coûterait deux clics.
    renderAt()

    fireEvent.click(screen.getByRole("button", { name: "Crayon" }))

    expect(screen.getByTestId("sheet")).toBeInTheDocument()
    expect(screen.queryByTestId("detail-sheet")).not.toBeInTheDocument()
})

test("refermer le formulaire ouvert au crayon ramène à la fiche", () => {
    renderAt()

    fireEvent.click(screen.getByRole("button", { name: "Crayon" }))
    fireEvent.click(screen.getByRole("button", { name: "Fermer le formulaire" }))

    expect(screen.getByTestId("detail-sheet")).toBeInTheDocument()
})

test("« Modifier » ouvre le formulaire, et le refermer ramène à la fiche", () => {
    renderAt("/stock-handpick/flux/in-1")

    fireEvent.click(screen.getByRole("button", { name: "Modifier" }))

    expect(screen.getByTestId("sheet")).toBeInTheDocument()
    expect(screen.queryByTestId("detail-sheet")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Fermer le formulaire" }))

    expect(screen.getByTestId("detail-sheet")).toBeInTheDocument()
    expect(screen.queryByTestId("sheet")).not.toBeInTheDocument()
})
