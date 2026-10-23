import React from "react";
import { expect, rstest, test } from "@rstest/core";
import { render, screen } from "@testing-library/react";

rstest.mock("@/features/content/context/ContentProvider", () => ({
    ContentProvider: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="content-provider">{children}</div>
    ),
}));

rstest.mock("@/features/content/components/Main", () => ({
    default: () => <div>ContentMain</div>,
}));

import ContentGeneration from "./ContentGeneration";

test("ContentGeneration renders main inside provider", () => {
    render(<ContentGeneration />);

    expect(screen.getByTestId("content-provider")).toBeInTheDocument();
    expect(screen.getByText("ContentMain")).toBeInTheDocument();
});
