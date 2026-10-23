import { expect, rstest, test } from "@rstest/core";
import { render, screen } from "@testing-library/react";

const mocks = rstest.hoisted(() => ({
    useAuth: rstest.fn(),
}));

rstest.mock("@/integrations/supabase/client", () => ({
    supabase: {
        from: rstest.fn(() => ({})),
        auth: { getUser: rstest.fn() },
        storage: { from: rstest.fn() },
        channel: rstest.fn(() => ({ on: rstest.fn().mockReturnThis(), subscribe: rstest.fn() })),
        removeChannel: rstest.fn(),
    },
}));

rstest.mock("@/features/auth/hooks/useAuth/AuthProvider", () => ({
    useAuth: mocks.useAuth,
}));

rstest.mock("@/features/tickets/components/OpenTicketTab", () => ({
    OpenTicketTab: () => <div>OpenTicketTab</div>,
}));

import Tickets from "./Tickets";

test("Tickets renders OpenTicketTab", () => {
    render(<Tickets />);
    expect(screen.getByText("OpenTicketTab")).toBeInTheDocument();
});
