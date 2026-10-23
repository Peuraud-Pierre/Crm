import { beforeEach, expect, rstest, test } from "@rstest/core"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ACTIVITY_LOG_LIMIT } from "@/features/stock/constants"
import { GROUPS_PER_PAGE } from "@/features/stock/utils/historyHelpers"
import type { ActivityLog } from "@/features/stock/types/history.types"

/**
 * Filet d'iso-comportement du board Historique.
 *
 * `HistoryBoard` orchestre trois vues, l'état de filtres, le refetch et la
 * pagination par groupes — le tout inline, et sans aucun test. Ce fichier fixe
 * cette orchestration avant qu'elle ne soit déportée vers une coquille
 * d'historique partagée avec le stock handpick.
 *
 * On ne teste PAS le dessin des lignes du feed ni celui des graphes : ils sont
 * remplacés par des sondes. Ce qui est vérifié ici, c'est ce que le board
 * décide — quelle vue, quels filtres comptés, quand la page repart à 1.
 *
 * À ne pas retoucher pendant le refactor.
 */

const mocks = rstest.hoisted(() => ({
    useHistoryContext: rstest.fn(),
    fetchActivityLogs: rstest.fn(),
    fetchPriceHistory: rstest.fn(),
}))

rstest.mock("@/features/stock/hooks/context/StockProvider", () => ({
    useHistoryContext: mocks.useHistoryContext,
}))

// Sondes : ces trois-là tirent recharts, des requêtes d'analyse et tout le
// vocabulaire d'entités. Le board ne fait que choisir lequel monter.
rstest.mock("./ActivityFeed", () => ({
    ActivityFeed: ({ groups, loading }: { groups: unknown[]; loading: boolean }) => (
        <div data-testid="feed" data-loading={String(loading)}>
            {groups.length}
        </div>
    ),
}))
rstest.mock("./analytics/FournisseurAnalytics", () => ({
    default: () => <div data-testid="analyse" />,
}))
rstest.mock("./PriceChartPanel", () => ({
    PriceChartPanel: () => <div data-testid="prix" />,
}))

import HistoryBoard from "./HistoryBoard"

// ─── Données ──────────────────────────────────────────────────────────────────

/**
 * Des logs qui ne se regroupent pas entre eux : action alternée et horodatages
 * espacés d'une heure, bien au-delà de la fenêtre de regroupement. Un log
 * entrant vaut donc un groupe, ce qui rend la pagination lisible.
 */
function isolatedLogs(count: number): ActivityLog[] {
    return Array.from({ length: count }, (_, i) => ({
        id: `log-${i}`,
        created_at: new Date(2026, 2, 1, 12 + i).toISOString(),
        user_id: `user-${i}`,
        entity_type: "balle" as const,
        entity_id: `e-${i}`,
        entity_label: `Balle ${i}`,
        action: "create" as const,
        description: null,
        changes: null,
    }))
}

function setContext(over: Partial<Record<string, unknown>> = {}) {
    mocks.useHistoryContext.mockReturnValue({
        activityLogs: [],
        logTotalCount: 0,
        priceHistory: [],
        userMap: new Map<string, string>(),
        loading: false,
        loadingLogs: false,
        fetchActivityLogs: mocks.fetchActivityLogs,
        fetchPriceHistory: mocks.fetchPriceHistory,
        ...over,
    })
}

const view = (name: RegExp) => screen.getByRole("button", { name })

beforeEach(() => {
    rstest.clearAllMocks()
    setContext()
})

// ─── Vues ─────────────────────────────────────────────────────────────────────

test("la vue par défaut est le journal", () => {
    render(<HistoryBoard />)

    expect(screen.getByTestId("feed")).toBeInTheDocument()
    expect(screen.queryByTestId("analyse")).not.toBeInTheDocument()
    expect(screen.queryByTestId("prix")).not.toBeInTheDocument()
})

test("les trois vues sont exclusives", async () => {
    render(<HistoryBoard />)
    const user = userEvent.setup()

    await user.click(view(/Analyse/))
    expect(screen.getByTestId("analyse")).toBeInTheDocument()
    expect(screen.queryByTestId("feed")).not.toBeInTheDocument()

    await user.click(view(/Prix/))
    expect(screen.getByTestId("prix")).toBeInTheDocument()
    expect(screen.queryByTestId("analyse")).not.toBeInTheDocument()

    await user.click(view(/Journal/))
    expect(screen.getByTestId("feed")).toBeInTheDocument()
})

test("la vue Prix retire le bouton Filtres et referme le panneau", async () => {
    render(<HistoryBoard />)
    const user = userEvent.setup()

    await user.click(screen.getByRole("button", { name: /Filtres/ }))
    expect(screen.getByLabelText("Début de période")).toBeInTheDocument()

    await user.click(view(/Prix/))
    expect(screen.queryByRole("button", { name: /Filtres/ })).not.toBeInTheDocument()

    // Le panneau ne doit pas se rouvrir tel quel en revenant au journal : la
    // bascule vers Prix a bien remis `filtersOpen` à faux.
    await user.click(view(/Journal/))
    expect(screen.queryByLabelText("Début de période")).not.toBeInTheDocument()
})

// ─── Comptage des filtres actifs ──────────────────────────────────────────────

test("la vue Analyse ne compte que la période, pas action ni type", async () => {
    render(<HistoryBoard />)
    const user = userEvent.setup()

    await user.click(screen.getByRole("button", { name: /Filtres/ }))
    await user.type(screen.getByLabelText("Début de période"), "2026-03-01")
    expect(screen.getByLabelText("1 filtre actif")).toBeInTheDocument()

    // La période reste comptée en Analyse ; action et type y sont hors sujet et
    // ne sont d'ailleurs plus proposés.
    await user.click(view(/Analyse/))
    expect(screen.getByLabelText("1 filtre actif")).toBeInTheDocument()
    expect(screen.queryByText("Action")).not.toBeInTheDocument()
})

test("les deux bornes de période comptent pour deux filtres", async () => {
    render(<HistoryBoard />)
    const user = userEvent.setup()

    await user.click(screen.getByRole("button", { name: /Filtres/ }))
    await user.type(screen.getByLabelText("Début de période"), "2026-03-01")
    await user.type(screen.getByLabelText("Fin de période"), "2026-03-31")

    expect(screen.getByLabelText("2 filtres actifs")).toBeInTheDocument()
})

test("Réinitialiser remet le compteur à zéro", async () => {
    render(<HistoryBoard />)
    const user = userEvent.setup()

    await user.click(screen.getByRole("button", { name: /Filtres/ }))
    await user.type(screen.getByLabelText("Début de période"), "2026-03-01")
    await user.click(screen.getByRole("button", { name: "Réinitialiser" }))

    expect(screen.queryByLabelText(/filtres? actifs?/)).not.toBeInTheDocument()
})

// ─── Refetch ──────────────────────────────────────────────────────────────────

test("un changement de période relance le fetch avec les bornes", async () => {
    render(<HistoryBoard />)
    mocks.fetchActivityLogs.mockClear()
    const user = userEvent.setup()

    await user.click(screen.getByRole("button", { name: /Filtres/ }))
    await user.type(screen.getByLabelText("Début de période"), "2026-03-01")

    expect(mocks.fetchActivityLogs).toHaveBeenCalledWith(
        expect.objectContaining({ dateFrom: "2026-03-01" }),
    )
})

test("Actualiser relance le fetch des logs, et celui des prix seulement en vue Prix", async () => {
    render(<HistoryBoard />)
    const user = userEvent.setup()

    await user.click(screen.getByRole("button", { name: /Actualiser/ }))
    expect(mocks.fetchPriceHistory).not.toHaveBeenCalled()

    await user.click(view(/Prix/))
    await user.click(screen.getByRole("button", { name: /Actualiser/ }))
    expect(mocks.fetchPriceHistory).toHaveBeenCalled()
})

// ─── Pagination par groupes ───────────────────────────────────────────────────

test("une page porte au plus GROUPS_PER_PAGE groupes", () => {
    setContext({ activityLogs: isolatedLogs(GROUPS_PER_PAGE + 5), logTotalCount: GROUPS_PER_PAGE + 5 })
    render(<HistoryBoard />)

    expect(screen.getByTestId("feed")).toHaveTextContent(String(GROUPS_PER_PAGE))
})

test("la page suivante sert le reste des groupes", async () => {
    setContext({ activityLogs: isolatedLogs(GROUPS_PER_PAGE + 5), logTotalCount: GROUPS_PER_PAGE + 5 })
    render(<HistoryBoard />)

    await userEvent.setup().click(screen.getByRole("button", { name: "2" }))

    expect(screen.getByTestId("feed")).toHaveTextContent("5")
})

test("changer un filtre ramène à la première page", async () => {
    setContext({ activityLogs: isolatedLogs(GROUPS_PER_PAGE + 5), logTotalCount: GROUPS_PER_PAGE + 5 })
    render(<HistoryBoard />)
    const user = userEvent.setup()

    await user.click(screen.getByRole("button", { name: "2" }))
    expect(screen.getByTestId("feed")).toHaveTextContent("5")

    await user.click(screen.getByRole("button", { name: /Filtres/ }))
    await user.type(screen.getByLabelText("Début de période"), "2026-03-01")

    // Sans ce reset, l'utilisateur reste sur une page 2 qui n'existe peut-être
    // plus après filtrage, et voit un feed vide sans explication.
    expect(screen.getByTestId("feed")).toHaveTextContent(String(GROUPS_PER_PAGE))
})

test("un seul groupe : compteur affiché, pas de boutons de page", () => {
    setContext({ activityLogs: isolatedLogs(1), logTotalCount: 1 })
    render(<HistoryBoard />)

    expect(screen.getByText(/1 groupe · 1 événement/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "2" })).not.toBeInTheDocument()
})

test("au plafond de fetch, le compteur annonce les N derniers événements", () => {
    setContext({ activityLogs: isolatedLogs(3), logTotalCount: ACTIVITY_LOG_LIMIT })
    render(<HistoryBoard />)

    expect(screen.getByText(/derniers événements/)).toBeInTheDocument()
})

test("aucun groupe : pas de pied de page", () => {
    setContext({ activityLogs: [], logTotalCount: 0 })
    render(<HistoryBoard />)

    expect(screen.queryByText(/groupes? ·/)).not.toBeInTheDocument()
})

test("pendant le chargement, le feed est prévenu", () => {
    setContext({ loading: true })
    render(<HistoryBoard />)

    expect(screen.getByTestId("feed")).toHaveAttribute("data-loading", "true")
})
