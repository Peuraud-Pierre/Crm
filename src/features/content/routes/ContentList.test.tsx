import { beforeEach, expect, rstest, test } from "@rstest/core";
import { render, screen } from "@testing-library/react";

const mocks = rstest.hoisted(() => ({
    order: rstest.fn(),
    select: rstest.fn(),
    eq: rstest.fn(),
    from: rstest.fn(),
}));

rstest.mock("@/integrations/supabase/client", () => ({
    supabase: {
        from: mocks.from,
        channel: rstest.fn(() => ({
            on: rstest.fn().mockReturnThis(),
            subscribe: rstest.fn().mockReturnThis(),
        })),
        removeChannel: rstest.fn(),
    },
}));

beforeEach(() => {
    rstest.clearAllMocks();
    const queryResult = { data: [], error: null };
    const query = {
        eq: mocks.eq,
        then: (onFulfilled: (value: typeof queryResult) => void) =>
            Promise.resolve(queryResult).then(onFulfilled),
    };
    mocks.eq.mockResolvedValue(queryResult);
    mocks.order.mockReturnValue(query);
    mocks.select.mockReturnValue({ order: mocks.order, eq: mocks.eq });
    mocks.from.mockReturnValue({ select: mocks.select });
});

import ContentList from "./ContentList";

test("ContentList shows empty state when no items", async () => {
    render(<ContentList userId="user-1" />);

    expect(
        await screen.findByText("Aucune génération de contenu pour le moment")
    ).toBeInTheDocument();
});
