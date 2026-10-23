import React from "react"
import { describe, it, expect, rstest } from "@rstest/core"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ComponentProps } from "react"
import { SecurityPanel } from "./SecurityPanel"

void React

type SecurityProps = ComponentProps<typeof SecurityPanel>

const mocks = rstest.hoisted(() => ({
    onOpenChange: rstest.fn(),
    forceBundleResync: rstest.fn().mockResolvedValue(undefined),
    purgeRemoteBundle: rstest.fn().mockResolvedValue(undefined),
    getExportKeyForQRCode: rstest.fn().mockReturnValue(null),
}))

const baseProps: SecurityProps = {
    isDesktop: true,
    open: true,
    onOpenChange: mocks.onOpenChange,
    locked: false,
    needsPassphrase: false,
    remoteBundleAvailable: false,
    forceBundleResync: mocks.forceBundleResync,
    purgeRemoteBundle: mocks.purgeRemoteBundle,
    getExportKeyForQRCode: mocks.getExportKeyForQRCode,
}

const renderPanel = (props?: Partial<SecurityProps>) =>
    render(<SecurityPanel {...baseProps} {...props} />)

describe("SecurityPanel", () => {
    describe("Visibility", () => {
        it("renders content when open", () => {
            renderPanel()
            const dialog = screen.getByRole("dialog")
            expect(within(dialog).getByText(/Options/i)).toBeDefined()
            expect(within(dialog).getByText(/Session active/i)).toBeDefined()
        })

        it("hides content when closed", () => {
            renderPanel({ open: false })
            expect(screen.queryByRole("dialog")).toBeNull()
        })
    })

    describe("Session status", () => {
        it("shows active session badge when not locked", () => {
            renderPanel({ locked: false })
            const dialog = screen.getByRole("dialog")
            expect(within(dialog).getByText(/Session active/i)).toBeDefined()
        })

        it("shows initializing message when locked without passphrase", () => {
            renderPanel({ locked: true, needsPassphrase: false })
            expect(
                screen.getByText(/Initialisation du chiffrement/i)
            ).toBeDefined()
        })
    })

    describe("Actions", () => {
        it("shows Resynchroniser button", () => {
            renderPanel()
            expect(
                screen.getByRole("button", { name: /Resynchroniser/i })
            ).toBeDefined()
        })

        it("triggers force resync when clicked", async () => {
            const user = userEvent.setup()
            renderPanel()

            await user.click(
                screen.getByRole("button", { name: /Resynchroniser/i })
            )

            expect(mocks.forceBundleResync).toHaveBeenCalled()
        })

        it("purges remote bundle when confirmed", async () => {
            const originalConfirm = window.confirm
            window.confirm = rstest.fn(() => true)
            const user = userEvent.setup()
            renderPanel()

            await user.click(
                screen.getByRole("button", { name: /Réinitialiser/i })
            )

            expect(mocks.purgeRemoteBundle).toHaveBeenCalled()
            window.confirm = originalConfirm
        })
    })
})
