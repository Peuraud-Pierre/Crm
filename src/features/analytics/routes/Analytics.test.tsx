import type React from "react"
import { beforeEach, expect, rstest, test } from "@rstest/core"
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router"

const mocks = rstest.hoisted(() => {
    const hasPermission = rstest.fn()
    const useAuth = rstest.fn(() => ({ hasPermission }))
    return { hasPermission, useAuth }
})

rstest.mock("@/features/auth/hooks/useAuth", () => ({
    useAuth: mocks.useAuth,
}))

// Les panneaux réels déclenchent des fetchs (Matomo, Supabase) : hors sujet ici,
// seul le routing des onglets est testé.
rstest.mock("@/features/matomo/routes/Matomo", () => ({
    default: () => <div>PanneauMatomo</div>,
}))
rstest.mock("@/features/leads/routes/LeadsStats", () => ({
    default: () => <div>PanneauLeads</div>,
}))

// L'onglet CRM est chargé en lazy() : une fois sa promesse résolue, il monte
// CRMProvider + AnalyticsTab, qui réclament le vrai AuthProvider (import direct,
// non couvert par le mock de "@/features/auth/hooks/useAuth" ci-dessus). Comme
// pour Matomo et Leads, seul le routing des onglets est testé ici.
rstest.mock("@/features/crm/AnalyticsTab", () => ({
    default: () => <div>PanneauCrm</div>,
}))
rstest.mock("@/features/crm/context/CRMContext", () => ({
    CRMProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import Analytics from "./Analytics"

function renderAt(path: string) {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path="/analytics/:tab?" element={<Analytics />} />
            </Routes>
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
})

test("matomo.view seul : onglet Matomo seul", () => {
    grant("matomo.view")
    renderAt("/analytics")

    expect(screen.getByRole("tab", { name: /trafic du site/i })).toBeInTheDocument()
    expect(
        screen.queryByRole("tab", { name: /statistiques leads/i })
    ).not.toBeInTheDocument()
    expect(
        screen.queryByRole("tab", { name: /activité commerciale/i })
    ).not.toBeInTheDocument()
})

test("leads_stats.view seul : onglet Leads seul, sélectionné", () => {
    grant("leads_stats.view")
    renderAt("/analytics")

    expect(screen.queryByRole("tab", { name: /trafic du site/i })).not.toBeInTheDocument()
    expect(
        screen.getByRole("tab", { name: /statistiques leads/i })
    ).toHaveAttribute("aria-selected", "true")
})

test("les deux droits : les deux onglets, aucun masquage", () => {
    grant("matomo.view", "leads_stats.view")
    renderAt("/analytics")

    expect(screen.getByRole("tab", { name: /trafic du site/i })).toBeInTheDocument()
    expect(
        screen.getByRole("tab", { name: /statistiques leads/i })
    ).toBeInTheDocument()
})

test("crm.view ajoute l'onglet activité commerciale", () => {
    grant("matomo.view", "crm.view")
    renderAt("/analytics")

    expect(
        screen.getByRole("tab", { name: /activité commerciale/i })
    ).toBeInTheDocument()
})

test("le slug de l'URL sélectionne l'onglet", async () => {
    grant("matomo.view", "crm.view")
    renderAt("/analytics/crm")

    expect(
        screen.getByRole("tab", { name: /activité commerciale/i })
    ).toHaveAttribute("aria-selected", "true")

    // Seul onglet chargé en lazy() : sa résolution doit être attendue DANS le
    // test, sinon elle retombe après sa fin ("A suspended resource finished
    // loading ... not wrapped in act"). Les autres tests n'activent pas cet
    // onglet, et Radix ne monte que le contenu de l'onglet actif.
    await screen.findByText("PanneauCrm")
})

test("slug non autorisé : redirigé vers le premier onglet visible", () => {
    grant("leads_stats.view")
    renderAt("/analytics/matomo")

    expect(
        screen.getByRole("tab", { name: /statistiques leads/i })
    ).toHaveAttribute("aria-selected", "true")
})

test("slug inconnu : redirigé vers le premier onglet visible", () => {
    grant("matomo.view")
    renderAt("/analytics/inconnu")

    expect(screen.getByRole("tab", { name: /trafic du site/i })).toHaveAttribute(
        "aria-selected",
        "true"
    )
})
