import { beforeEach, expect, rstest, test } from "@rstest/core"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const mocks = rstest.hoisted(() => ({
    usePushPreference: rstest.fn(),
    enable: rstest.fn(),
    disable: rstest.fn(),
    onChange: rstest.fn(),
}))

rstest.mock("@/features/profile/hooks/data/usePushPreference", () => ({
    usePushPreference: mocks.usePushPreference,
}))

import { NotificationsCard } from "./NotificationsCard"

const PREFERENCES = {
    theme: "system" as const,
    push_enabled: true,
    notify_ticket: true,
    notify_message: true,
    notify_system: true,
}

function pushState(overrides: Record<string, unknown> = {}) {
    mocks.usePushPreference.mockReturnValue({
        permission: "granted",
        subscribed: true,
        busy: false,
        enable: mocks.enable,
        disable: mocks.disable,
        ...overrides,
    })
}

beforeEach(() => {
    rstest.clearAllMocks()
    mocks.enable.mockResolvedValue(true)
    mocks.disable.mockResolvedValue(true)
    mocks.onChange.mockResolvedValue(true)
    pushState()
})

test("une permission refusée désactive le toggle et l'explique", () => {
    pushState({ permission: "denied", subscribed: false })

    render(
        <NotificationsCard
            preferences={PREFERENCES}
            disabled={false}
            onChange={mocks.onChange}
        />
    )

    expect(screen.getByLabelText("Activer sur cet appareil")).toBeDisabled()
    expect(
        screen.getByText(/bloquées dans les réglages du navigateur/)
    ).toBeInTheDocument()
})

test("un navigateur sans support désactive le toggle", () => {
    pushState({ permission: "unsupported", subscribed: false })

    render(
        <NotificationsCard
            preferences={PREFERENCES}
            disabled={false}
            onChange={mocks.onChange}
        />
    )

    expect(screen.getByLabelText("Activer sur cet appareil")).toBeDisabled()
    expect(
        screen.getByText(/ne prend pas en charge les notifications push/)
    ).toBeInTheDocument()
})

test("désactiver le push révoque l'abonnement avant de persister", async () => {
    const user = userEvent.setup()
    render(
        <NotificationsCard
            preferences={PREFERENCES}
            disabled={false}
            onChange={mocks.onChange}
        />
    )

    await user.click(screen.getByLabelText("Activer sur cet appareil"))

    await waitFor(() => expect(mocks.disable).toHaveBeenCalled())
    expect(mocks.onChange).toHaveBeenCalledWith({ push_enabled: false })
})

test("un échec côté navigateur n'enregistre pas le consentement", async () => {
    pushState({ permission: "default", subscribed: false })
    mocks.enable.mockResolvedValue(false)
    const user = userEvent.setup()

    render(
        <NotificationsCard
            preferences={{ ...PREFERENCES, push_enabled: false }}
            disabled={false}
            onChange={mocks.onChange}
        />
    )

    await user.click(screen.getByLabelText("Activer sur cet appareil"))

    await waitFor(() => expect(mocks.enable).toHaveBeenCalled())
    expect(mocks.onChange).not.toHaveBeenCalled()
})

test("basculer un type in-app persiste la préférence correspondante", async () => {
    const user = userEvent.setup()
    render(
        <NotificationsCard
            preferences={PREFERENCES}
            disabled={false}
            onChange={mocks.onChange}
        />
    )

    await user.click(screen.getByLabelText("Messages"))

    await waitFor(() =>
        expect(mocks.onChange).toHaveBeenCalledWith({ notify_message: false })
    )
})
