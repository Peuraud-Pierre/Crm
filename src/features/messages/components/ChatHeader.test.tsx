import React from "react"
import { describe, it, expect, rstest } from "@rstest/core"

void React
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ComponentProps } from "react"
import { ChatHeader } from "./ChatHeader"

type ChatHeaderProps = ComponentProps<typeof ChatHeader>

const mocks = rstest.hoisted(() => ({
    setShowUsers: rstest.fn(),
}))

const baseProps: ChatHeaderProps = {
    selectedRecipientId: null,
    setShowUsers: mocks.setShowUsers,
    showBundleSynced: false,
    bundleSynced: false,
    securityPanel: null,
}

const renderComponent = (props?: Partial<ChatHeaderProps>) =>
    render(<ChatHeader {...baseProps} {...props} />)

describe("ChatHeader", () => {
    describe("Rendering", () => {
        it("shows the default copy when no recipient is selected", () => {
            const { container } = renderComponent()
            expect(container.textContent).toContain(
                "Selectionne un utilisateur a gauche"
            )
        })

        it("shows active conversation copy when a recipient is selected", () => {
            const { container } = renderComponent({
                selectedRecipientId: "recipient-456",
            })
            expect(container.textContent).toContain(
                "Conversation securisee active"
            )
        })
    })

    describe("Status badges", () => {
        it("renders the synced badge when bundle is synced and the flag is enabled", () => {
            renderComponent({ showBundleSynced: true, bundleSynced: true })
            expect(screen.getByText(/Synchronise/i)).toBeDefined()
        })

        it("hides the synced badge when the bundle is not synced", () => {
            renderComponent({ showBundleSynced: true, bundleSynced: false })
            expect(screen.queryByText(/Synchronise/i)).toBeNull()
        })
    })

    describe("Actions", () => {
        it("opens the users panel when the mobile toggle is clicked", async () => {
            const user = userEvent.setup()
            renderComponent()

            const toggle = screen.getByRole("button", { name: /Utilisateurs/i })
            await user.click(toggle)

            expect(baseProps.setShowUsers).toHaveBeenCalledWith(true)
        })
    })

    describe("Injected panel", () => {
        it("renders the provided security panel", () => {
            renderComponent({ securityPanel: <div>Panel Content</div> })
            expect(screen.getByText(/Panel Content/i)).toBeDefined()
        })
    })
})
