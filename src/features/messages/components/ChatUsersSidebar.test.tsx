import React from "react"
import { describe, it, expect, rstest } from "@rstest/core"

void React
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ComponentProps } from "react"
import { ChatUsersSidebar } from "./ChatUsersSidebar"

type SidebarProps = ComponentProps<typeof ChatUsersSidebar>

const mockUsers: SidebarProps["groups"] = {
    default: [
        {
            user_id: "user-1",
            status: "active",
            full_name: "Alice",
            email: "alice@example.com",
            avatar_url: null,
        },
        {
            user_id: "user-2",
            status: "offline",
            full_name: "Bob",
            email: "bob@example.com",
            avatar_url: null,
        },
    ],
}

const mocks = rstest.hoisted(() => ({
    setShowUsers: rstest.fn(),
    setSelectedRecipientId: rstest.fn(),
}))

const baseProps: SidebarProps = {
    showUsers: false,
    setShowUsers: mocks.setShowUsers,
    groups: mockUsers,
    usersLoading: false,
    unreadByUser: {},
    selectedRecipientId: null,
    setSelectedRecipientId: mocks.setSelectedRecipientId,
}

const renderComponent = (props?: Partial<SidebarProps>) =>
    render(<ChatUsersSidebar {...baseProps} {...props} />)

describe("ChatUsersSidebar", () => {
    describe("Rendering", () => {
        it("shows the header with total count", () => {
            renderComponent()
            expect(screen.getByText(/Utilisateurs/i)).toBeDefined()
            expect(screen.getByText(/2 disponibles/i)).toBeDefined()
        })

        it("lists users by group", () => {
            renderComponent()
            expect(screen.getByText("Alice")).toBeDefined()
            expect(screen.getByText("Bob")).toBeDefined()
        })
    })

    describe("Visibility", () => {
        it("renders the mobile overlay when sidebar is open", () => {
            const { container } = renderComponent({ showUsers: true })
            // eslint-disable-next-line nokk-project/no-restricted-syntax -- scrim/overlay volontairement noir quel que soit le thème (design system §12.4)
            const overlay = container.querySelector("[class*='bg-black/40']")
            expect(overlay).toBeDefined()
        })

        it("hides the overlay when sidebar is closed", () => {
            const { container } = renderComponent({ showUsers: false })
            // eslint-disable-next-line nokk-project/no-restricted-syntax -- scrim/overlay volontairement noir quel que soit le thème (design system §12.4)
            const overlay = container.querySelector("[class*='bg-black/40']")
            expect(overlay).toBeNull()
        })
    })

    describe("User selection", () => {
        it("sets the selected recipient and closes the sidebar", async () => {
            const user = userEvent.setup()
            renderComponent({ showUsers: true })

            await user.click(screen.getByText("Alice"))

            expect(baseProps.setSelectedRecipientId).toHaveBeenCalledWith(
                "user-1"
            )
            expect(baseProps.setShowUsers).toHaveBeenCalledWith(false)
        })

        it("marks the active user with styles", () => {
            renderComponent({ selectedRecipientId: "user-2" })

            const activeButton = screen.getByText("Bob").closest("button")
            // État actif unifié sur les tokens (cf. revue UX) au lieu de slate-900.
            expect(activeButton?.className).toContain("bg-primary")
            expect(activeButton?.className).toContain("text-primary-foreground")

            // Ensure the active badge ring uses the active color.
            // Ancré sur data-testid : le sélecteur structurel précédent visait
            // « le dernier span imbriqué », donc n'importe quel remaniement du
            // markup de l'avatar le faisait tomber sur un autre élément.
            const statusDot = activeButton?.querySelector(
                "[data-testid='presence-dot']"
            )
            expect(statusDot?.className).toContain("bg-primary-foreground")
        })
    })

    describe("Statuses and unread", () => {
        it("shows online/offline text for each user", () => {
            const { container } = renderComponent()
            expect(container.textContent).toContain("En ligne")
            expect(container.textContent).toContain("Hors ligne")
        })

        it("shows unread badge when provided", () => {
            renderComponent({ unreadByUser: { "user-2": 3 } })
            expect(screen.getByText("+3")).toBeDefined()
        })
    })

    describe("Overlay interactions", () => {
        it("closes when the overlay is clicked", async () => {
            const user = userEvent.setup()
            const { container } = renderComponent({ showUsers: true })

            // eslint-disable-next-line nokk-project/no-restricted-syntax -- scrim/overlay volontairement noir quel que soit le thème (design system §12.4)
            const overlay = container.querySelector("[class*='bg-black/40']")
            await user.click(overlay as HTMLElement)

            expect(baseProps.setShowUsers).toHaveBeenCalledWith(false)
        })
    })
})
