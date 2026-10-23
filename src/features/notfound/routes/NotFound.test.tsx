import { expect, rstest, test } from "@rstest/core";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router";

import NotFound from "./NotFound";

test("NotFound renders 404 content", () => {
    const consoleSpy = rstest
        .spyOn(console, "error")
        .mockImplementation(() => {});

    window.history.pushState({}, "", "/missing");
    render(
        <BrowserRouter>
            <NotFound />
        </BrowserRouter>
    );

    expect(screen.getByText("404")).toBeInTheDocument();
    expect(screen.getByText("Oops! Page not found")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Return to Home" })).toHaveAttribute(
        "href",
        "/"
    );

    consoleSpy.mockRestore();
});
