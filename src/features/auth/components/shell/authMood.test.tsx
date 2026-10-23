import { afterEach, expect, rstest, test } from "@rstest/core"
import { act, render, screen } from "@testing-library/react"
import { AuthMoodProvider, MoodSignal, useAuthMood, type AuthMood } from "./authMood"

function Probe() {
    const { mood, hops } = useAuthMood()
    return <output data-testid="probe">{`${mood}:${hops}`}</output>
}

function Setter({ to }: { to: AuthMood }) {
    const { setMood } = useAuthMood()
    return <button onClick={() => setMood(to)}>{to}</button>
}

afterEach(() => {
    rstest.useRealTimers()
})

test("an error shakes then returns to idle on its own", () => {
    rstest.useFakeTimers()
    render(
        <AuthMoodProvider>
            <Probe />
            <Setter to="error" />
        </AuthMoodProvider>
    )

    act(() => screen.getByRole("button", { name: "error" }).click())
    expect(screen.getByTestId("probe")).toHaveTextContent("error:0")

    act(() => {
        rstest.advanceTimersByTime(700)
    })
    expect(screen.getByTestId("probe")).toHaveTextContent("idle:0")
})

test("MoodSignal relays the mood and one hop per added character", () => {
    const { rerender } = render(
        <AuthMoodProvider>
            <Probe />
            <MoodSignal mood="busy" typed={0} />
        </AuthMoodProvider>
    )
    expect(screen.getByTestId("probe")).toHaveTextContent("busy:0")

    rerender(
        <AuthMoodProvider>
            <Probe />
            <MoodSignal mood={null} typed={2} />
        </AuthMoodProvider>
    )
    // Effacer un caractère ne fait pas sauter de lettre.
    rerender(
        <AuthMoodProvider>
            <Probe />
            <MoodSignal mood={null} typed={1} />
        </AuthMoodProvider>
    )
    expect(screen.getByTestId("probe")).toHaveTextContent("busy:1")
})

test("outside a shell the mood is inert", () => {
    render(<Probe />)
    expect(screen.getByTestId("probe")).toHaveTextContent("idle:0")
})
