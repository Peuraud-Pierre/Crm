import { expect, rstest, test } from "@rstest/core";
import { render, screen } from "@testing-library/react";

rstest.mock("@/shared/context/GestionContext", () => ({
    // Mock du hook réel : doit garder le préfixe "use".
    // eslint-disable-next-line react-x/no-unnecessary-use-prefix
    useGestionsContext: () => ({
        fetch_balle: rstest.fn(),
        balle: [],
        update_balle: rstest.fn(),
    }),
}));

rstest.mock("@/shared/context/ProfilesProvider", () => ({
    // Mock du hook réel : doit garder le préfixe "use".
    // eslint-disable-next-line react-x/no-unnecessary-use-prefix
    useProfilesCtx: () => ({ profiles: [] }),
}));

rstest.mock("@/features/auth/hooks/useAuth/AuthProvider", () => ({
    // Mock du hook réel : doit garder le préfixe "use".
    // eslint-disable-next-line react-x/no-unnecessary-use-prefix
    useAuth: () => ({ user: { user_id: "user-1" } }),
}));

rstest.mock("@/features/sorters/components/manager_trie/MerchandiseGrid", () => ({
    MerchandiseGrid: () => <div>MerchandiseGrid</div>,
}));

import ManagerSort from "./Manage_Sorter";

test("Manage_Sorter renders header", () => {
    render(<ManagerSort />);

    expect(screen.getByText("Gestion des balles")).toBeInTheDocument();
});
