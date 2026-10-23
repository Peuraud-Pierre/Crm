import React from "react";
import { expect, rstest, test } from "@rstest/core";
import { render, screen } from "@testing-library/react";

rstest.mock("@/features/sorters/context/SortersProvider", () => ({
    SortersProvider: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="sorters-provider">{children}</div>
    ),
}));

rstest.mock("@/features/sorters/components/Main", () => ({
    default: () => <div>SortersMain</div>,
}));

import Sorters from "./Sorters";

test("Sorters renders main inside provider", () => {
    render(<Sorters userId="test-user" adminView={false} />);

    expect(screen.getByTestId("sorters-provider")).toBeInTheDocument();
    expect(screen.getByText("SortersMain")).toBeInTheDocument();
});
