import { beforeEach, expect, rstest, test } from "@rstest/core"
import { render, screen } from "@testing-library/react"

const mocks = rstest.hoisted(() => {
    const state = {
        etages: { etages: [] as unknown[], loading: false, error: null as string | null },
    }
    const emptyPlan = {
        zones: [], emplacements: [], equipements: [], tree: [], items: [], loading: false, error: null,
        contentOf: () => ({ zones: 0, emplacements: 0, equipements: 0 }),
    }
    return {
        state,
        useEtages: rstest.fn(() => ({ ...state.etages, create: rstest.fn(), update: rstest.fn(), remove: rstest.fn(), refetch: rstest.fn() })),
        usePlanMagasin: rstest.fn(() => emptyPlan),
        useFond: rstest.fn(() => ({ layer: null, imageUrl: null, busy: false, hasFond: false })),
    }
})

rstest.mock("@/features/magasins/hooks/data/useEtages", () => ({ useEtages: mocks.useEtages }))
rstest.mock("@/features/magasins/hooks/data/usePlanMagasin", () => ({ usePlanMagasin: mocks.usePlanMagasin }))
rstest.mock("@/features/magasins/hooks/data/useFond", () => ({ useFond: mocks.useFond }))
// Les onglets eux-mêmes ne sont pas l'objet de ce test.
rstest.mock("../plan/PlanTab", () => ({ PlanTab: () => <div data-testid="plan-tab" /> }))
rstest.mock("../emplacements/EmplacementsTab", () => ({ EmplacementsTab: () => <div /> }))

import { MagasinDetail } from "./MagasinDetail"
import type { Magasin } from "@/features/magasins/types/magasin.types"

const magasin = { id: "m1", code: "PAR", nom: "Paris", largeur: 20, profondeur: 15, is_active: true } as Magasin

function renderDetail() {
    return render(
        <MagasinDetail
            magasin={magasin}
            section="plan"
            data={{ update: rstest.fn(), remove: rstest.fn() } as never}
            permissions={{ create: true, update: true, delete: true }}
            onSectionChange={() => {}}
            onBack={() => {}}
        />,
    )
}

beforeEach(() => {
    mocks.state.etages = { etages: [], loading: false, error: null }
})

test("sans étage chargé, pas d'outils d'édition qui perdraient le travail : un message dit quoi faire", () => {
    mocks.state.etages = { etages: [], loading: false, error: "Impossible de charger les étages." }
    renderDetail()
    expect(screen.queryByTestId("plan-tab")).toBeNull()
    expect(screen.getByRole("alert")).toHaveTextContent(/20261008110000_magasins_etages/)
})

test("avec un étage, le plan s'affiche", () => {
    mocks.state.etages = {
        etages: [{ id: "rdc", magasin_id: "m1", nom: "RDC", niveau: 0, contour: null, fond_path: null, fond_opacite: 0.5 }],
        loading: false,
        error: null,
    }
    renderDetail()
    expect(screen.getByTestId("plan-tab")).toBeInTheDocument()
    expect(screen.queryByRole("alert")).toBeNull()
})
