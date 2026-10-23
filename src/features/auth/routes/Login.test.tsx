import { expect, rstest, test } from "@rstest/core"
import { render, screen } from "@testing-library/react"

import Login from "./Login"

rstest.mock("@/features/auth/components/login/Login", () => ({
    LoginFlow: () => <div data-testid="login-flow" />,
}))

test("Login renders the login flow", () => {
    render(<Login />)

    expect(screen.getByTestId("login-flow")).toBeInTheDocument()
})
