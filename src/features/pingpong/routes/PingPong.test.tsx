import { expect, rstest, test } from "@rstest/core";
import { render, screen } from "@testing-library/react";

rstest.mock("@/features/auth/hooks/useAuth/AuthProvider", () => ({
    // eslint-disable-next-line react-x/no-unnecessary-use-prefix -- mocked hook must keep the original hook name
    useAuth: () => ({ user: { id: "user-1" } }),
}));

rstest.mock("@/shared/context/ProfilesProvider", () => ({
    // eslint-disable-next-line react-x/no-unnecessary-use-prefix -- mocked hook must keep the original hook name
    useProfilesCtx: () => ({ profiles: [] }),
}));

rstest.mock("@/features/pingpong/hooks/Ping_Pong_hook/usePingPong", () => ({
    // eslint-disable-next-line react-x/no-unnecessary-use-prefix -- mocked hook must keep the original hook name
    usePingPong: () => ({
        players: [],
        tournaments: [],
        participants: [],
        matches: [],
        loading: false,
        createTournament: rstest.fn(),
        updateMatchResult: rstest.fn(),
        deleteTournament: rstest.fn(),
        refetch: rstest.fn(),
    }),
}));

rstest.mock("@/shared/components/layout/PageHelpBubble", () => ({
    PageHelpBubble: () => <div>HelpBubble</div>,
}));

import PingPong from "./PingPong";

test("PingPong renders leaderboard section", () => {
    render(<PingPong />);

    expect(screen.getByText("Classement des joueurs")).toBeInTheDocument();
});
