import { expect, rstest, test } from "@rstest/core";
import { render, screen } from "@testing-library/react";
import { SellJournalProvider } from "@/features/sell-journal/context/SellJournalContext";

rstest.mock("@/features/journal/hooks/Journal_hook/useJournalEntry", () => ({
    // eslint-disable-next-line react-x/no-unnecessary-use-prefix -- mock of a real hook, name must match
    useJournalEntry: () => ({
        entries: [],
        createEntry: rstest.fn(),
        updateEntry: rstest.fn(),
        deleteEntry: rstest.fn(),
        fetchEntries: rstest.fn(),
        setEntries: rstest.fn(),
    }),
}));

rstest.mock("@/features/auth/hooks/useAuth", () => ({
    // eslint-disable-next-line react-x/no-unnecessary-use-prefix -- mock of a real hook, name must match
    useAuth: () => ({ user: { user_id: "user-1", full_name: "Test User" } }),
}));

rstest.mock("@/integrations/supabase/client", () => ({
    supabase: {
        channel: () => ({
            on: () => ({
                subscribe: () => ({}),
            }),
        }),
        removeChannel: () => {},
    },
}));

rstest.mock("@/features/sell-journal/components/EntriesTab", () => ({
    EntriesTab: () => <div>EntriesTab</div>,
}));

rstest.mock("@/features/sell-journal/components/BilanTab", () => ({
    BilanTab: () => <div>BilanTab</div>,
}));

rstest.mock("@/features/sell-journal/components/StatsTab", () => ({
    StatsTab: () => <div>StatsTab</div>,
}));

import { SellJournal } from "./SellJournal";

test("SellJournal renders header", () => {
    render(
        <SellJournalProvider>
            <SellJournal />
        </SellJournalProvider>
    );

    expect(screen.getByText("Aujourd'hui")).toBeInTheDocument();
});
