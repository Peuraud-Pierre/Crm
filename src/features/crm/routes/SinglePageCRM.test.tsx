import React from "react";
import { expect, rstest, test } from "@rstest/core";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

rstest.mock("@/features/crm/context/CRMContext", () => ({
    // eslint-disable-next-line react-x/no-unnecessary-use-prefix -- nom du hook mocké
    useCRMContext: () => ({
        activeTab: "calendar",
        setActiveTab: rstest.fn(),
        setSelectedClient: rstest.fn(),
        FicheClient: false,
        setFicheclient: rstest.fn(),
        setCustomer: rstest.fn(),
        setClientToOpen: rstest.fn(),
        clientToOpen: null,
        fetchOneClient: rstest.fn().mockResolvedValue(null),
        loadMoreClients: rstest.fn().mockResolvedValue(undefined),
        loadMoreInColumn: rstest.fn().mockResolvedValue(undefined),
        loadingColumns: new Set<number>(),
        exhaustedColumns: new Set<number>(),
        hasMoreClients: false,
        isLoadingMoreClients: false,
    }),
}));

rstest.mock("@/features/auth/hooks/useAuth", () => ({
    // eslint-disable-next-line react-x/no-unnecessary-use-prefix -- nom du hook mocké
    useAuth: () => ({
        user: { user_id: "test-user" },
        permissionsLoaded: true,
        hasPermission: () => true,
    }),
}));

rstest.mock("@/features/crm/AnalyticsTab", () => ({
    default: () => <div>AnalyticsTab</div>,
}));

rstest.mock("@/features/crm/CalendarTab", () => ({
    default: () => <div>CalendarTab</div>,
}));

rstest.mock("@/features/crm/CustomersTab", () => ({
    default: () => <div>CustomersTab</div>,
}));

rstest.mock("@/features/crm/QuotesTab", () => ({
    default: () => <div>QuotesTab</div>,
}));

rstest.mock("@/features/crm/Tachetab", () => ({
    default: () => <div>TacheTab</div>,
}));

rstest.mock("@/features/tournee/routes/TourneeTab", () => ({
    default: () => <div>TourneeTab</div>,
}));

rstest.mock("@/features/crm/components/Client/fiche", () => ({
    default: () => <div>CustomerDetailDialog</div>,
}));

rstest.mock("@/shared/ui/atoms/tabs", () => ({
    Tabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    TabsList: ({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
    ),
    TabsTrigger: ({ children }: { children: React.ReactNode }) => (
        <button>{children}</button>
    ),
    TabsContent: ({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
    ),
}));

import SinglePageCRM from "./SinglePageCRM";

test("SinglePageCRM renders tabs", async () => {
    render(
        <MemoryRouter>
            <SinglePageCRM />
        </MemoryRouter>
    );

    expect(screen.getByText("Calendrier")).toBeInTheDocument();

    // Le mock de Tabs ci-dessus rend TOUS les TabsContent, là où le vrai Radix ne
    // monte que l'onglet actif : les quatre composants lazy() de SinglePageCRM se
    // montent donc ensemble. On attend leur résolution DANS le test, sinon elle
    // retombe après sa fin ("A suspended resource finished loading ... not
    // wrapped in act"). Un simple flush de microtâches ne suffit pas : un
    // import() dynamique se résout plus tard.
    await Promise.all(
        ["CalendarTab", "QuotesTab", "TacheTab", "TourneeTab"].map((label) =>
            screen.findByText(label)
        )
    );
});
