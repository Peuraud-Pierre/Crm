// ── FlowBoard.test.tsx ────────────────────────────────────────────────────────
// Ce fichier existe pour une raison précise : le tableau des arrivages masquait
// bien son crayon d'édition derrière `stock.arrivage.update`, mais l'URL
// /stock/arrivage/{id} ouvrait la sheet d'édition à tout détenteur de
// stock.arrivage.view. La RLS refusait l'écriture, donc rien n'a pu être
// modifié — mais on proposait un formulaire voué à échouer. Masquer une entrée
// ne protège pas sa destination : c'est ce que ces tests verrouillent.
//
// Cette prémisse tient toujours, mais la destination a changé. Le segment de
// détail ouvre désormais une fiche de LECTURE (`ArrivageDetailSheet`), gatée
// sur `stock.arrivage.view` ; le formulaire ne s'ouvre plus que sur une action
// explicite, et seulement avec `stock.arrivage.update`. Les tests ci-dessous
// ont été réécrits en conséquence, chacun nommant celui qu'il supersede.

import { beforeEach, expect, rstest, test } from "@rstest/core"
import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes, useLocation, useParams } from "react-router"
import { STOCK_PERMISSIONS } from "@/features/stock/constants"
import type { ArrivageManuelRow } from "@/features/stock/types/arrivage-manuel.types"

const ROW = { id: "abc", container_no: "MSCU1234567" } as ArrivageManuelRow

const mocks = rstest.hoisted(() => {
    const hasPermission = rstest.fn()
    return {
        hasPermission,
        useAuth: rstest.fn(() => ({ hasPermission })),
        rows: { current: undefined as ArrivageManuelRow[] | undefined },
    }
})

rstest.mock("@/features/auth/hooks/useAuth/AuthProvider", () => ({
    useAuth: mocks.useAuth,
}))

rstest.mock("@/features/stock/hooks/context/StockProvider", () => ({
    // eslint-disable-next-line react-x/no-unnecessary-use-prefix -- mock de hook
    useArrivageManuelContext: () => ({ rows: mocks.rows.current }),
}))

// Les enfants montent le module entier (contextes, Supabase) : on n'observe
// ici que le montage conditionnel, donc de simples marqueurs suffisent.
rstest.mock("./ArrivageLimitedTable", () => ({
    default: ({
        onEdit,
        onPacking,
    }: {
        onEdit: (row: { id: string }) => void
        onPacking?: (row: ArrivageManuelRow) => void
    }) => (
        <div data-testid="table">
            <button type="button" onClick={() => onEdit({ id: "abc" })}>
                Crayon
            </button>
            {onPacking && (
                <button
                    type="button"
                    onClick={() => onPacking(mocks.rows.current?.[0] as ArrivageManuelRow)}
                >
                    Icône packing
                </button>
            )}
        </div>
    ),
}))
rstest.mock("./packing/PackingListSheet", () => ({
    PackingListSheet: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
        open ? (
            <div data-testid="packing-sheet">
                <button type="button" onClick={onClose}>
                    Fermer la packing
                </button>
            </div>
        ) : null,
}))
rstest.mock("./ArrivageLimitedCreationSheet", () => ({
    default: ({ open }: { open: boolean }) =>
        open ? <div data-testid="creation-sheet" /> : null,
}))
rstest.mock("./ArrivageLimitedEditSheet", () => ({
    default: ({ onClose }: { onClose: () => void }) => (
        <div data-testid="edit-sheet">
            <button type="button" onClick={onClose}>
                Fermer le formulaire
            </button>
        </div>
    ),
}))
rstest.mock("./ArrivageDetailSheet", () => ({
    ArrivageDetailSheet: ({
        open,
        onEdit,
        onOpenPacking,
    }: {
        open: boolean
        onEdit?: () => void
        onOpenPacking?: () => void
    }) =>
        open ? (
            <div data-testid="detail-sheet">
                {onEdit && (
                    <button type="button" onClick={onEdit}>
                        Modifier
                    </button>
                )}
                {onOpenPacking && (
                    <button type="button" onClick={onOpenPacking}>
                        Section packing
                    </button>
                )}
            </div>
        ) : null,
}))
rstest.mock("./ExportArrivageButton", () => ({ default: () => null }))

import FlowBoard from "./FlowBoard"

function Probe() {
    return <span data-testid="path">{useLocation().pathname}</span>
}

/**
 * En usage réel, `detail` vient de `TabbedModuleRoute`, qui le tire de l'URL.
 * On le relaie ici depuis les paramètres de route — et non en prop figée, sans
 * quoi une navigation déclenchée par le board (le raccourci du crayon, le
 * nettoyage d'un lien mort) ne se répercuterait pas sur ce qu'il reçoit.
 */
function FlowBoardWithDetail() {
    const { detail } = useParams()
    return <FlowBoard detail={detail} />
}

function renderBoard(detail?: string) {
    return render(
        <MemoryRouter
            initialEntries={[`/stock/flux${detail ? `/${detail}` : ""}`]}
        >
            <Routes>
                <Route path="/stock/flux/:detail?" element={<FlowBoardWithDetail />} />
            </Routes>
            <Probe />
        </MemoryRouter>
    )
}

const grant = (...codes: string[]) => {
    mocks.hasPermission.mockImplementation((code: string) =>
        codes.includes(code)
    )
}

beforeEach(() => {
    rstest.clearAllMocks()
    mocks.rows.current = [ROW]
})

test("sans stock.arrivage.view, le tableau n'est pas rendu du tout", () => {
    grant()
    renderBoard()
    expect(screen.queryByTestId("table")).toBeNull()
})

test("un deep-link ouvre la FICHE et non le formulaire", () => {
    // Supersede « la sheet d'édition s'ouvre avec stock.arrivage.update » :
    // l'URL adresse l'arrivage, pas un mode de saisie.
    grant(STOCK_PERMISSIONS.arrivageView, STOCK_PERMISSIONS.arrivageUpdate)
    renderBoard(ROW.id)
    expect(screen.getByTestId("detail-sheet")).toBeTruthy()
    expect(screen.queryByTestId("edit-sheet")).toBeNull()
    expect(screen.getByTestId("path").textContent).toBe(`/stock/flux/${ROW.id}`)
})

test("avec stock.arrivage.view seul, la fiche s'ouvre sans proposer de modifier", () => {
    // Supersede « sans stock.arrivage.update, le deep-link d'édition ne l'ouvre
    // pas » : le formulaire reste hors d'atteinte, mais la consultation ne
    // renvoie plus ce compte vers la liste — c'était le défaut à corriger.
    grant(STOCK_PERMISSIONS.arrivageView)
    renderBoard(ROW.id)
    expect(screen.getByTestId("detail-sheet")).toBeTruthy()
    expect(screen.queryByTestId("edit-sheet")).toBeNull()
    expect(screen.queryByRole("button", { name: "Modifier" })).toBeNull()
    expect(screen.getByTestId("path").textContent).toBe(`/stock/flux/${ROW.id}`)
})

test("sans stock.arrivage.view, le deep-link retombe sur la liste", () => {
    grant()
    renderBoard(ROW.id)
    expect(screen.queryByTestId("detail-sheet")).toBeNull()
    expect(screen.getByTestId("path").textContent).toBe("/stock/flux")
})

test("le refus n'attend pas le chargement des arrivages", () => {
    // `rows` indéfini = requête en vol. La décision ne dépend que de la
    // permission : la laisser attendre afficherait la fiche entre-temps.
    grant()
    mocks.rows.current = undefined
    renderBoard(ROW.id)
    expect(screen.queryByTestId("detail-sheet")).toBeNull()
    expect(screen.getByTestId("path").textContent).toBe("/stock/flux")
})

test("« Modifier » ouvre le formulaire, et le refermer ramène à la fiche", () => {
    grant(STOCK_PERMISSIONS.arrivageView, STOCK_PERMISSIONS.arrivageUpdate)
    renderBoard(ROW.id)

    fireEvent.click(screen.getByRole("button", { name: "Modifier" }))
    expect(screen.getByTestId("edit-sheet")).toBeTruthy()
    expect(screen.queryByTestId("detail-sheet")).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Fermer le formulaire" }))
    expect(screen.getByTestId("detail-sheet")).toBeTruthy()
    expect(screen.queryByTestId("edit-sheet")).toBeNull()
    // L'URL n'a pas bougé : le mode d'édition est une action, pas une adresse.
    expect(screen.getByTestId("path").textContent).toBe(`/stock/flux/${ROW.id}`)
})

test("la sheet de création s'ouvre avec stock.arrivage.create", () => {
    grant(STOCK_PERMISSIONS.arrivageView, STOCK_PERMISSIONS.arrivageCreate)
    renderBoard("new")
    expect(screen.getByTestId("creation-sheet")).toBeTruthy()
})

test("sans stock.arrivage.create, le deep-link de création ne l'ouvre pas", () => {
    grant(STOCK_PERMISSIONS.arrivageView)
    renderBoard("new")
    expect(screen.queryByTestId("creation-sheet")).toBeNull()
    expect(screen.getByTestId("path").textContent).toBe("/stock/flux")
})

test("le crayon du tableau ouvre le formulaire sans passer par la fiche", () => {
    // Raccourci : `openEdit` pose le drapeau d'édition AVANT de naviguer, sinon
    // l'URL ouvrirait la fiche de lecture et le crayon coûterait deux clics.
    grant(STOCK_PERMISSIONS.arrivageView, STOCK_PERMISSIONS.arrivageUpdate)
    renderBoard()

    fireEvent.click(screen.getByRole("button", { name: "Crayon" }))

    expect(screen.getByTestId("edit-sheet")).toBeTruthy()
    expect(screen.queryByTestId("detail-sheet")).toBeNull()
    expect(screen.getByTestId("path").textContent).toBe(`/stock/flux/${ROW.id}`)
})

test("refermer le formulaire ouvert au crayon ramène à la fiche", () => {
    grant(STOCK_PERMISSIONS.arrivageView, STOCK_PERMISSIONS.arrivageUpdate)
    renderBoard()

    fireEvent.click(screen.getByRole("button", { name: "Crayon" }))
    fireEvent.click(screen.getByRole("button", { name: "Fermer le formulaire" }))

    expect(screen.getByTestId("detail-sheet")).toBeTruthy()
})

// ─── Packing list ─────────────────────────────────────────────────────────────

test("l'icône packing ouvre la sheet packing sans passer par la fiche", () => {
    grant(STOCK_PERMISSIONS.arrivageView, STOCK_PERMISSIONS.packingCreate)
    mocks.rows.current = [{ ...ROW, packing: null }]
    renderBoard()

    fireEvent.click(screen.getByRole("button", { name: "Icône packing" }))

    expect(screen.getByTestId("packing-sheet")).toBeTruthy()
    expect(screen.queryByTestId("detail-sheet")).toBeNull()
    expect(screen.getByTestId("path").textContent).toBe(`/stock/flux/${ROW.id}`)
})

test("refermer la packing ramène à la fiche, URL inchangée", () => {
    grant(STOCK_PERMISSIONS.arrivageView, STOCK_PERMISSIONS.packingCreate)
    mocks.rows.current = [{ ...ROW, packing: null }]
    renderBoard()

    fireEvent.click(screen.getByRole("button", { name: "Icône packing" }))
    fireEvent.click(screen.getByRole("button", { name: "Fermer la packing" }))

    expect(screen.getByTestId("detail-sheet")).toBeTruthy()
    expect(screen.queryByTestId("packing-sheet")).toBeNull()
    expect(screen.getByTestId("path").textContent).toBe(`/stock/flux/${ROW.id}`)
})

test("la section packing de la fiche ouvre la même sheet", () => {
    grant(STOCK_PERMISSIONS.arrivageView, STOCK_PERMISSIONS.packingView)
    mocks.rows.current = [
        { ...ROW, packing: { id: "p1", status: "a_verifier" } as ArrivageManuelRow["packing"] },
    ]
    renderBoard(ROW.id)

    fireEvent.click(screen.getByRole("button", { name: "Section packing" }))

    expect(screen.getByTestId("packing-sheet")).toBeTruthy()
})

test("sans droit sur la packing, ni section dans la fiche ni ouverture par l'icône", () => {
    // Masquer l'entrée ne protège pas la destination : l'icône appelée
    // quand même ne doit rien ouvrir.
    grant(STOCK_PERMISSIONS.arrivageView)
    mocks.rows.current = [{ ...ROW, packing: null }]
    renderBoard()

    fireEvent.click(screen.getByRole("button", { name: "Icône packing" }))

    expect(screen.queryByTestId("packing-sheet")).toBeNull()
    expect(screen.queryByRole("button", { name: "Section packing" })).toBeNull()
})

test("synthèses non chargées : la fiche ne propose pas la packing", () => {
    grant(STOCK_PERMISSIONS.arrivageView, STOCK_PERMISSIONS.packingView, STOCK_PERMISSIONS.packingCreate)
    renderBoard(ROW.id)

    expect(screen.getByTestId("detail-sheet")).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Section packing" })).toBeNull()
})

test("un id inconnu retombe sur la liste, même avec la permission", () => {
    grant(STOCK_PERMISSIONS.arrivageView, STOCK_PERMISSIONS.arrivageUpdate)
    renderBoard("inconnu")
    expect(screen.queryByTestId("detail-sheet")).toBeNull()
    expect(screen.queryByTestId("edit-sheet")).toBeNull()
    expect(screen.getByTestId("path").textContent).toBe("/stock/flux")
})
