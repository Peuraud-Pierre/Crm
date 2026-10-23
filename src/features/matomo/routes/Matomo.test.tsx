import { beforeEach, expect, rstest, test } from "@rstest/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";

const mocks = rstest.hoisted(() => ({
    fetch: rstest.fn(),
}));

rstest.mock("@/features/matomo/components/MatomoChannels", () => ({
    default: () => <div>MatomoChannels</div>,
}));

rstest.mock("@/features/matomo/components/MatomoCharts", () => ({
    default: () => <div>MatomoCharts</div>,
}));

rstest.mock("@/features/matomo/components/MatomoConfigBar", () => ({
    default: ({
        live,
        filters,
    }: {
        live: number;
        filters: { periodKey: string; query: { siteId: string } };
    }) => (
        <div>
            live:{live} periode:{filters.periodKey} site:{filters.query.siteId}
        </div>
    ),
}));

rstest.mock("@/features/matomo/components/MatomoKPIGrid", () => ({
    default: () => <div>MatomoKPIGrid</div>,
}));

rstest.mock("@/features/matomo/components/MatomoMap", () => ({
    default: () => <div>MatomoMap</div>,
}));

rstest.mock("@/features/matomo/components/VisitsLog/VisitsLog", () => ({
    default: () => <div>VisitsLog</div>,
}));

import Matomo from "./Matomo";

beforeEach(() => {
    rstest.clearAllMocks();
    mocks.fetch.mockImplementation(async (url: string) => ({
        ok: true,
        json: async () =>
            url.includes("/live?")
                ? [{ visitors: 3 }]
                : url.includes("/sites")
                  ? [{ idsite: "5", name: "Nokk_project Handpick", main_url: "https://nokk-project.example" }]
                  : [],
    }));
    global.fetch = mocks.fetch as typeof fetch;
});

function renderAt(url: string) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
        <MemoryRouter initialEntries={[url]}>
            <QueryClientProvider client={client}>
                <Matomo />
            </QueryClientProvider>
        </MemoryRouter>
    );
}

test("Matomo passe le compteur temps réel à la barre de config", async () => {
    renderAt("/analytics/matomo");

    await waitFor(() => {
        expect(screen.getByText(/live:3/)).toBeInTheDocument();
    });
});

test("les filtres viennent de l'URL et une valeur inconnue retombe sur le défaut", async () => {
    renderAt("/analytics/matomo?site=5&periode=week:last12");
    expect(screen.getByText(/periode:week:last12 site:5/)).toBeInTheDocument();
    // 12 semaines closes, en série hebdomadaire pour la courbe.
    expect(mocks.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/timeline\?idSite=5&period=week&date=\d{4}-\d{2}-\d{2}%2C\d{4}-\d{2}-\d{2}/)
    );
});

test("une période inconnue dans l'URL ne casse pas la page", () => {
    renderAt("/analytics/matomo?periode=n'importe-quoi");
    expect(screen.getByText(/periode:day:last30/)).toBeInTheDocument();
});

test("un site absent de la liste bascule sur le premier site accessible", async () => {
    renderAt("/analytics/matomo?site=999");
    await waitFor(() => {
        expect(screen.getByText(/site:5/)).toBeInTheDocument();
    });
});
