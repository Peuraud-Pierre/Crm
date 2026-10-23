import { expect, rstest, describe, it, beforeEach } from "@rstest/core"
import { render, screen, waitFor } from "@testing-library/react"
import type { VeilleItem } from "../types/veille.types"

rstest.mock("@/integrations/supabase/client", () => ({
    supabase: {
        from: rstest.fn(),
        rpc: rstest.fn(),
    },
}))

rstest.mock("@/features/auth/hooks/useAuth/AuthProvider", () => ({
    useAuth: rstest.fn(),
}))

rstest.mock("../hooks/useVeilleReports", () => ({
    useVeilleReports: rstest.fn(),
}))

// useTopics et useN8nWorkflow ne sont pas le sujet de ces tests, mais sans mock
// ils tournent pour de vrai : useTopics déclenche un useEffect -> fetchWatchConfigs
// -> client Supabase mocké renvoyant undefined -> le catch appelle setState APRÈS
// la fin des tests synchrones, d'où "not wrapped in act(...)". Avec isolate:false
// (rstest.config.ts) cette mise à jour tardive peut retomber dans le fichier suivant.
rstest.mock("../hooks/useTopics", () => ({
    useTopics: rstest.fn(),
}))

rstest.mock("../hooks/useN8nWorkflow", () => ({
    useN8nWorkflow: rstest.fn(),
}))

rstest.mock("@/shared/components/layout/Header", () => ({
    Header: ({ title }: { title: string }) => <div>{title}</div>,
}))

rstest.mock("../components/VeilleCardAuto", () => ({
    VeilleCardAuto: ({ item }: { item: VeilleItem }) => {
        let text = "Card for " + item.id
        if (item.executive_summary) {
            try {
                const parsed = JSON.parse(item.executive_summary)
                text = "Veille " + parsed.periode
            } catch {
                // ignore parse errors
            }
        }
        return <div data-testid="veille-card-auto">{text}</div>
    },
}))

import Veille from "./Veille"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { useVeilleReports } from "../hooks/useVeilleReports"
import { useTopics } from "../hooks/useTopics"
import { useN8nWorkflow } from "../hooks/useN8nWorkflow"

const mockVeilleItem: VeilleItem = {
    id: "test-id",
    created_at: "2026-02-10T08:35:52.934Z",
    period_start: null,
    period_end: null,
    topic: "test topic",
    frequency: "weekly",
    source_model: "test-model",
    analysis_model: "test-analysis",
    raw_research: "test research",
    executive_summary: JSON.stringify({
        date_veille: "2026-02-10",
        periode: "7 derniers jours",
        secteurs_cibles: ["Test"],
        actualites_principales: [],
        sections: [],
    }),
    risks: "",
    opportunities: "",
    recommended_actions: "",
    importance_score: 3,
    tags: [],
    metadata: {},
}

describe("Veille", () => {
    beforeEach(() => {
        rstest.clearAllMocks()

        rstest.mocked(useTopics).mockReturnValue({
            configs: [],
            loading: false,
            error: null,
            createConfig: rstest.fn(),
            updateConfig: rstest.fn(),
            deleteConfig: rstest.fn(),
            refetch: rstest.fn(),
        })

        rstest.mocked(useN8nWorkflow).mockReturnValue({
            executing: false,
            lastExecution: null,
            error: null,
            execute: rstest.fn(),
            clearError: rstest.fn(),
            clearLastExecution: rstest.fn(),
            fetchLatest: rstest.fn(),
        })
    })

    it("affiche le chargement quand l'utilisateur n'est pas connecté", () => {
        rstest.mocked(useAuth).mockReturnValue({
            user: null,
            session: null,
            loading: false,
            signIn: rstest.fn(),
            signUp: rstest.fn(),
            signOut: rstest.fn(),
            resetPassword: rstest.fn(),
            updatePassword: rstest.fn(),
            refreshSession: rstest.fn(),
            allowedRoutes: [],
            permissions: [],
        })

        rstest.mocked(useVeilleReports).mockReturnValue({
            reports: [],
            loading: true,
            error: null,
            refetch: rstest.fn(),
        })

        render(<Veille />)
        expect(screen.getByText("Chargement…")).toBeInTheDocument()
    })

    it("affiche le chargement des rapports", () => {
        rstest.mocked(useAuth).mockReturnValue({
            user: {
                id: "test-user",
                email: "test@test.com",
                full_name: "Test User",
            },
            session: null,
            loading: false,
            signIn: rstest.fn(),
            signUp: rstest.fn(),
            signOut: rstest.fn(),
            resetPassword: rstest.fn(),
            updatePassword: rstest.fn(),
            refreshSession: rstest.fn(),
            allowedRoutes: [],
            permissions: [],
        })

        rstest.mocked(useVeilleReports).mockReturnValue({
            reports: [],
            loading: true,
            error: null,
            refetch: rstest.fn(),
        })

        render(<Veille />)
        expect(
            screen.getByText("Chargement des rapports...")
        ).toBeInTheDocument()
    })

    it("affiche un message quand il n'y a pas de rapports", async () => {
        rstest.mocked(useAuth).mockReturnValue({
            user: {
                id: "test-user",
                email: "test@test.com",
                full_name: "Test User",
            },
            session: null,
            loading: false,
            signIn: rstest.fn(),
            signUp: rstest.fn(),
            signOut: rstest.fn(),
            resetPassword: rstest.fn(),
            updatePassword: rstest.fn(),
            refreshSession: rstest.fn(),
            allowedRoutes: [],
            permissions: [],
        })

        rstest.mocked(useVeilleReports).mockReturnValue({
            reports: [],
            loading: false,
            error: null,
            refetch: rstest.fn(),
        })

        render(<Veille />)
        await waitFor(() => {
            expect(
                screen.getByText("Aucun rapport disponible")
            ).toBeInTheDocument()
        })
    })

    it("affiche les rapports de veille", async () => {
        rstest.mocked(useAuth).mockReturnValue({
            user: {
                id: "test-user",
                email: "test@test.com",
                full_name: "Test User",
            },
            session: null,
            loading: false,
            signIn: rstest.fn(),
            signUp: rstest.fn(),
            signOut: rstest.fn(),
            resetPassword: rstest.fn(),
            updatePassword: rstest.fn(),
            refreshSession: rstest.fn(),
            allowedRoutes: [],
            permissions: [],
        })

        rstest.mocked(useVeilleReports).mockReturnValue({
            reports: [mockVeilleItem],
            loading: false,
            error: null,
            refetch: rstest.fn(),
        })

        render(<Veille />)
        await waitFor(() => {
            expect(
                screen.getByText("Veille 7 derniers jours")
            ).toBeInTheDocument()
        })
    })

    it("affiche une erreur quand le chargement échoue", async () => {
        rstest.mocked(useAuth).mockReturnValue({
            user: {
                id: "test-user",
                email: "test@test.com",
                full_name: "Test User",
            },
            session: null,
            loading: false,
            signIn: rstest.fn(),
            signUp: rstest.fn(),
            signOut: rstest.fn(),
            resetPassword: rstest.fn(),
            updatePassword: rstest.fn(),
            refreshSession: rstest.fn(),
            allowedRoutes: [],
            permissions: [],
        })

        rstest.mocked(useVeilleReports).mockReturnValue({
            reports: [],
            loading: false,
            error: new Error("Test error"),
            refetch: rstest.fn(),
        })

        render(<Veille />)
        await waitFor(() => {
            expect(screen.getByText("Erreur de chargement")).toBeInTheDocument()
            expect(screen.getByText("Test error")).toBeInTheDocument()
        })
    })
})
