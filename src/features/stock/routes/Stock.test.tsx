import { beforeEach, expect, rstest, test } from "@rstest/core"
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes, useLocation } from "react-router"
import { STOCK_PERMISSIONS } from "@/features/stock/constants"
import { LEGACY_SECTIONS, type StockTabDef } from "../types/ui.types"

/**
 * Ce qui est propre au stock principal : sa matrice de permissions, son onglet
 * par défaut, et ses alias d'URL historiques.
 *
 * L'algorithme de canonicalisation lui-même n'est plus testé ici — il vit dans
 * `shared/lib/tabbedModule.ts` et y est couvert en table, sur une config
 * fictive. Le tester une seconde fois à travers ce module reviendrait à
 * documenter le stock là où c'est le socle qui est en cause.
 */

const mocks = rstest.hoisted(() => {
    const hasPermission = rstest.fn()
    const useAuth = rstest.fn(() => ({ hasPermission }))
    return { hasPermission, useAuth }
})

rstest.mock("@/features/auth/hooks/useAuth/AuthProvider", () => ({
    useAuth: mocks.useAuth,
}))

// StockTabs monte tout le module (contextes, Supabase) : on n'observe ici que
// le gating, donc on expose seulement les onglets retenus.
rstest.mock("../components/StockTabs", () => ({
    default: ({ activeTab, detail, visibleTabs }: {
        activeTab: string
        detail?: string
        visibleTabs: StockTabDef[]
    }) => (
        <div data-testid="stock-tabs">
            <span data-testid="active">{activeTab}</span>
            <span data-testid="detail">{detail ?? ""}</span>
            {visibleTabs.map((tab) => (
                <span key={tab.id} data-testid={`tab-${tab.section}`} />
            ))}
        </div>
    ),
}))

import Stock from "./Stock"

/** Expose l'URL courante : c'est elle qui prouve la canonicalisation. */
function LocationProbe() {
    const { pathname } = useLocation()
    return <span data-testid="path">{pathname}</span>
}

function renderAt(path: string) {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <LocationProbe />
            <Routes>
                <Route path="/stock/:section?/:detail?" element={<Stock />} />
            </Routes>
        </MemoryRouter>
    )
}

const grant = (...codes: string[]) => {
    mocks.hasPermission.mockImplementation((code: string) => codes.includes(code))
}

beforeEach(() => {
    rstest.clearAllMocks()
})

// ─── Câblage ──────────────────────────────────────────────────────────────────

test("Stock renders StockTabs", () => {
    grant()
    renderAt("/stock/flux")

    expect(screen.getByTestId("stock-tabs")).toBeInTheDocument()
    expect(screen.getByTestId("tab-flux")).toBeInTheDocument()
})

test("Flux est l'onglet par défaut du stock principal", () => {
    grant()
    renderAt("/stock")

    expect(screen.getByTestId("active")).toHaveTextContent("fluxTab")
    expect(screen.getByTestId("path")).toHaveTextContent("/stock/flux")
})

// ─── Matrice de permissions ───────────────────────────────────────────────────

test("sans permission : ni Paramètres ni Historique", () => {
    grant()
    renderAt("/stock/flux")

    expect(screen.queryByTestId("tab-parametres")).not.toBeInTheDocument()
    expect(screen.queryByTestId("tab-historique")).not.toBeInTheDocument()
})

test("stock.settings.view ouvre l'onglet Paramètres, pas l'Historique", () => {
    grant(STOCK_PERMISSIONS.settingsView)
    renderAt("/stock/parametres")

    expect(screen.getByTestId("tab-parametres")).toBeInTheDocument()
    expect(screen.queryByTestId("tab-historique")).not.toBeInTheDocument()
})

test("stock.history.view ouvre l'onglet Historique", () => {
    grant(STOCK_PERMISSIONS.historyView)
    renderAt("/stock/historique")

    expect(screen.getByTestId("tab-historique")).toBeInTheDocument()
})

// ─── Compatibilité des liens (segments renommés le 2026-09-08) ─────────────
// `arrivage` → `flux` et `stock` → `inventaire`. Ces segments circulent dans
// des favoris, des liens de notification et les widgets du dashboard : rien
// n'expire un favori, ces redirections sont permanentes.

test("`/stock/arrivage/{id}` est réécrit en `/stock/flux/{id}`", () => {
    // C'est LE cas qui casserait un lien de notification : /stock/arrivage/{id}
    // ouvre la sheet d'édition de l'arrivage {id}. Perdre le détail en chemin
    // renverrait l'utilisateur sur une liste sans lui dire pourquoi.
    //
    // Le détail fait aussi de ce test le seul qui discrimine réellement :
    // `/stock/arrivage` NU produit `/stock/flux` même sans alias, puisque Flux
    // est l'onglet par défaut. Un test sur le segment seul ne pourrait pas
    // échouer — il n'y en a donc pas.
    grant()
    renderAt("/stock/arrivage/abc-123")

    expect(screen.getByTestId("path").textContent).toBe("/stock/flux/abc-123")
    expect(screen.getByTestId("detail")).toHaveTextContent("abc-123")
})

test("la table d'alias couvre les deux segments renommés", () => {
    // `stock` → `inventaire` ne s'observe pas à l'écran : l'onglet Inventaire
    // est `devOnly`, donc masqué hors développement, et l'URL retombe sur le
    // défaut quoi qu'il arrive. On vérifie donc la table elle-même — la
    // traduction est prouvée par le test `arrivage` ci-dessus, qui partage
    // exactement le même chemin de code.
    expect(LEGACY_SECTIONS).toEqual({ arrivage: "flux", stock: "inventaire" })
})

// ─── Salle de tri et salle de commande : pages à part (2026-10-01) ──────────
// Elles ont leurs propres routes (/salle-de-tri, /commandes) : /stock ne doit
// pas les exposer en onglets, même à qui en détient les droits.

test("la salle de tri et les commandes ne sont pas des onglets de /stock", () => {
    grant("stock.tri.view", "stock.commandes.view")
    renderAt("/stock/tri/new")

    expect(screen.queryByTestId("tab-tri")).not.toBeInTheDocument()
    expect(screen.queryByTestId("tab-commandes")).not.toBeInTheDocument()
    expect(screen.getByTestId("path").textContent).toBe("/stock/flux")
})
