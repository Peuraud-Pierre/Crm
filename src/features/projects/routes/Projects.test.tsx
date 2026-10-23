import React from "react";
import { expect, rstest, test } from "@rstest/core";
import { render, screen } from "@testing-library/react";

rstest.mock("@/features/projects/hooks/context/Project/ProjectProvider", () => ({
    ProjectProvider: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="project-provider">{children}</div>
    ),
}));

rstest.mock("@/features/projects/components/project/Main", () => ({
    Main: () => <div>ProjectsMain</div>,
}));

import Projects from "./Projects";

test("Projects renders main inside provider", () => {
    render(<Projects />);

    expect(screen.getByTestId("project-provider")).toBeInTheDocument();
    expect(screen.getByText("ProjectsMain")).toBeInTheDocument();
});
