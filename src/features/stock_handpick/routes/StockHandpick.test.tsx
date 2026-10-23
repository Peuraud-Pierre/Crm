import { beforeEach, expect, rstest, test } from "@rstest/core"
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes, useLocation } from "react-router"
import { STOCK_HANDPICK_PERMISSIONS } from "@/features/stock_handpick/constants"
import type { HandpickTabDef } from "../types/ui.types"

/**
 * Ce qui est propre au stock handpick : son onglet par défaut, et sa matrice de
 * permissions — c'est le seul des deux modules dont les CINQ onglets sont gatés,
 * sans aucun backfill de permission au déploiement.
 *
 * L'algorithme de canonicalisation vit dans `shared/lib/tabbedModule.ts` et y
 * est couvert en table ; le re-tester ici testerait le socle deux fois.
 */

const mocks = rstest.hoisted(() => {
    const hasPermission = rstest.fn()
    const useAuth = rstest.fn(() => ({ hasPermission }))
    return { hasPermission, useAuth }
})

rstest.mock("@/features/auth/hooks/useAuth/AuthProvider", () => ({
    useAuth: mocks.useAuth,
}))

// Le composant Tabs monte tout le module (contextes, Supabase) : on n'observe
// ici que le gating, donc on expose seulement ce que la route a retenu.
rstest.mock("../components/Tabs", () => ({
    default: ({ activeTab, detail, visibleTabs }: {
        activeTab: string
        detail?: string
        visibleTabs: HandpickTabDef[]
    }) => (
        <div data-testid="handpick-tabs">
            <span data-testid="active">{activeTab}</span>
            <span data-testid="detail">{detail ?? ""}</span>
            {visibleTabs.map((tab) => (
                <span key={tab.id} data-testid={`tab-${tab.section}`} />
            ))}
        </div>
    ),
}))

import StockHandpick from "./StockHandpick"

function LocationProbe() {
    const { pathname } = useLocation()
    return <span data-testid="path">{pathname}</span>
}

function renderAt(path: string) {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <LocationProbe />
            <Routes>
                <Route path="/stock-handpick/:section?/:detail?" element={<StockHandpick />} />
            </Routes>
        </MemoryRouter>,
    )
}

const grant = (...codes: string[]) => {
    mocks.hasPermission.mockImplementation((code: string) => codes.includes(code))
}

beforeEach(() => {
    rstest.clearAllMocks()
})

// ─── Câblage ──────────────────────────────────────────────────────────────────

test("l'onglet Inventaire est rendu avec sa permission", () => {
    grant(STOCK_HANDPICK_PERMISSIONS.inventaireView)
    renderAt("/stock-handpick/inventaire")

    expect(screen.getByTestId("handpick-tabs")).toBeInTheDocument()
    expect(screen.getByTestId("active")).toHaveTextContent("inventaireTab")
    expect(screen.getByTestId("tab-inventaire")).toBeInTheDocument()
})

test("Inventaire est l'onglet par défaut du handpick", () => {
    grant(STOCK_HANDPICK_PERMISSIONS.inventaireView)
    renderAt("/stock-handpick")

    expect(screen.getByTestId("active")).toHaveTextContent("inventaireTab")
    expect(screen.getByTestId("path")).toHaveTextContent("/stock-handpick/inventaire")
})

// ─── Matrice de permissions ───────────────────────────────────────────────────

test("chaque onglet est gaté par sa propre permission", () => {
    grant(STOCK_HANDPICK_PERMISSIONS.inventaireView)
    renderAt("/stock-handpick/inventaire")

    expect(screen.queryByTestId("tab-codes")).not.toBeInTheDocument()
    expect(screen.queryByTestId("tab-historique")).not.toBeInTheDocument()
    expect(screen.queryByTestId("tab-parametres")).not.toBeInTheDocument()
})

test("stock_handpick.plan.view ouvre l'onglet Codes", () => {
    grant(STOCK_HANDPICK_PERMISSIONS.planView)
    renderAt("/stock-handpick/codes")

    expect(screen.getByTestId("tab-codes")).toBeInTheDocument()
    expect(screen.getByTestId("active")).toHaveTextContent("codesTab")
})

test("l'onglet Flux, retiré, n'est plus servi même avec sa permission", () => {
    grant(STOCK_HANDPICK_PERMISSIONS.inventaireView, STOCK_HANDPICK_PERMISSIONS.fluxView)
    renderAt("/stock-handpick/flux")

    expect(screen.getByTestId("active")).toHaveTextContent("inventaireTab")
    expect(screen.queryByTestId("tab-flux")).not.toBeInTheDocument()
})

test("une section non autorisée retombe sur l'onglet par défaut", () => {
    grant(STOCK_HANDPICK_PERMISSIONS.inventaireView)
    renderAt("/stock-handpick/parametres")

    expect(screen.getByTestId("active")).toHaveTextContent("inventaireTab")
    expect(screen.queryByTestId("tab-parametres")).not.toBeInTheDocument()
})

test("sans aucune permission, aucun onglet n'est servi", () => {
    // Les 19 permKeys du module sont créées sans backfill : au déploiement,
    // administrateur compris, personne ne voit rien tant que rien n'est accordé
    // depuis /administration. L'écran doit rester inerte, pas planter.
    grant()
    renderAt("/stock-handpick/inventaire")

    expect(screen.queryByTestId("tab-inventaire")).not.toBeInTheDocument()
    expect(screen.getByTestId("handpick-tabs")).toBeInTheDocument()
})

// ─── Détail ───────────────────────────────────────────────────────────────────

test("le détail d'un onglet à id libre est conservé", () => {
    // Codes ne déclare pas de `details` : son segment est un id d'emplacement
    // (l'URL portée par l'étiquette QR), il doit traverser la canonicalisation
    // intact.
    grant(STOCK_HANDPICK_PERMISSIONS.planView)
    renderAt("/stock-handpick/codes/3f2b8c1e-9a4d-4e21-b7c5-0d6e8f9a1b2c")

    expect(screen.getByTestId("active")).toHaveTextContent("codesTab")
    expect(screen.getByTestId("detail")).toHaveTextContent("3f2b8c1e-9a4d-4e21-b7c5-0d6e8f9a1b2c")
})
