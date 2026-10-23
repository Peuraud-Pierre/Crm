import { beforeEach, expect, rstest, test } from "@rstest/core"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation, useNavigationType } from "react-router"
import type { TabbedModuleConfig, TabDef } from "@/shared/types/tabbed-module.types"

/**
 * Ce que le test pur de `shared/lib/tabbedModule` ne peut pas voir : le gating
 * réel par `hasPermission` et `isDev`, et surtout la NATURE des navigations —
 * la correction d'URL doit être en `replace`, la navigation d'onglet en `push`.
 * Les confondre ne casse rien de visible : le bouton retour du navigateur se
 * met simplement à sauter des étapes, ou à ne plus sortir du module.
 *
 * Config fictive, jamais celle d'un module réel.
 */

const mocks = rstest.hoisted(() => {
    const hasPermission = rstest.fn()
    return { hasPermission, useAuth: rstest.fn(() => ({ hasPermission })) }
})

rstest.mock("@/features/auth/hooks/useAuth/AuthProvider", () => ({
    useAuth: mocks.useAuth,
}))

// `isDev` est figé au build : on le pilote pour éprouver les deux branches.
const env = rstest.hoisted(() => ({ isDev: true }))
rstest.mock("@/shared/lib/env", () => ({
    get isDev() {
        return env.isDev
    },
}))

import TabbedModuleRoute from "./TabbedModuleRoute"

type Id = "alphaTab" | "betaTab" | "gammaTab"

const TABS: TabDef<Id>[] = [
    { id: "alphaTab", section: "alpha", devOnly: true },
    { id: "betaTab", section: "beta" },
    { id: "gammaTab", section: "gamma", permission: "demo.gamma.view", details: ["un", "deux"] },
]

const config: TabbedModuleConfig<Id> = {
    routeBase: "/demo",
    tabs: TABS,
    defaultTab: "betaTab",
    legacySections: { ancien: "beta" },
}

/** Expose l'URL et la nature de la dernière navigation. */
function Probe() {
    const { pathname } = useLocation()
    return (
        <>
            <span data-testid="path">{pathname}</span>
            <span data-testid="navtype">{useNavigationType()}</span>
        </>
    )
}

function renderAt(path: string) {
    return render(
        <MemoryRouter initialEntries={["/demo/beta", path]} initialIndex={1}>
            <Probe />
            <Routes>
                <Route
                    path="/demo/:section?/:detail?"
                    element={
                        <TabbedModuleRoute config={config}>
                            {({ activeTab, detail, visibleTabs, goToTab }) => (
                                <div>
                                    <span data-testid="active">{activeTab}</span>
                                    <span data-testid="detail">{detail ?? ""}</span>
                                    {visibleTabs.map((tab) => (
                                        <span key={tab.id} data-testid={`tab-${tab.section}`} />
                                    ))}
                                    <button type="button" onClick={() => goToTab("betaTab")}>
                                        aller-beta
                                    </button>
                                </div>
                            )}
                        </TabbedModuleRoute>
                    }
                />
            </Routes>
        </MemoryRouter>,
    )
}

const grant = (...codes: string[]) => {
    mocks.hasPermission.mockImplementation((code: string) => codes.includes(code))
}

beforeEach(() => {
    rstest.clearAllMocks()
    env.isDev = true
    grant()
})

// ─── Gating ───────────────────────────────────────────────────────────────────

test("un onglet sans permission est visible dès l'accès au module", () => {
    renderAt("/demo/beta")

    expect(screen.getByTestId("tab-beta")).toBeInTheDocument()
})

test("un onglet permissionné est masqué sans sa permission", () => {
    renderAt("/demo/beta")

    expect(screen.queryByTestId("tab-gamma")).not.toBeInTheDocument()
})

test("un onglet permissionné apparaît avec sa permission", () => {
    grant("demo.gamma.view")
    renderAt("/demo/beta")

    expect(screen.getByTestId("tab-gamma")).toBeInTheDocument()
})

test("un onglet devOnly est visible en développement", () => {
    renderAt("/demo/beta")

    expect(screen.getByTestId("tab-alpha")).toBeInTheDocument()
})

test("un onglet devOnly disparaît hors développement", () => {
    env.isDev = false
    renderAt("/demo/beta")

    expect(screen.queryByTestId("tab-alpha")).not.toBeInTheDocument()
})

// ─── Canonicalisation ─────────────────────────────────────────────────────────

test("une section inconnue est réécrite vers l'onglet par défaut", () => {
    renderAt("/demo/nimportequoi")

    expect(screen.getByTestId("path")).toHaveTextContent("/demo/beta")
})

test("un segment historique est réécrit en conservant le détail", () => {
    renderAt("/demo/ancien/abc-123")

    expect(screen.getByTestId("path")).toHaveTextContent("/demo/beta/abc-123")
    expect(screen.getByTestId("detail")).toHaveTextContent("abc-123")
})

test("une sous-section inconnue est réécrite vers la première", () => {
    grant("demo.gamma.view")
    renderAt("/demo/gamma/nimportequoi")

    expect(screen.getByTestId("path")).toHaveTextContent("/demo/gamma/un")
})

test("la correction d'URL est en replace : elle ne s'empile pas", () => {
    // Sans `replace`, chaque arrivée sur une URL non canonique laisserait une
    // entrée morte dans l'historique, et le bouton retour y ramènerait — donc
    // rejouerait la correction en boucle.
    renderAt("/demo/nimportequoi")

    expect(screen.getByTestId("navtype")).toHaveTextContent("REPLACE")
})

test("une URL déjà canonique ne déclenche aucune navigation", () => {
    renderAt("/demo/beta")

    // POP = l'entrée initiale, aucune correction n'a été émise par-dessus.
    expect(screen.getByTestId("navtype")).toHaveTextContent("POP")
})

// ─── Navigation d'onglet ──────────────────────────────────────────────────────

test("la navigation d'onglet est en push : le retour refait le chemin inverse", async () => {
    grant("demo.gamma.view")
    renderAt("/demo/gamma/un")

    await userEvent.setup().click(screen.getByRole("button", { name: "aller-beta" }))

    expect(screen.getByTestId("path")).toHaveTextContent("/demo/beta")
    expect(screen.getByTestId("navtype")).toHaveTextContent("PUSH")
})

test("changer d'onglet ne traîne pas le détail de l'onglet quitté", () => {
    grant("demo.gamma.view")
    renderAt("/demo/gamma/deux")

    expect(screen.getByTestId("detail")).toHaveTextContent("deux")
})

// ─── Enveloppe ────────────────────────────────────────────────────────────────

test("le contenu est enveloppé par le template de page", () => {
    const { container } = renderAt("/demo/beta")

    expect(container.querySelector(".h-full.p-5")).not.toBeNull()
})
