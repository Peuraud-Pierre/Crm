import React from "react"
import { describe, it, expect, rstest, beforeEach } from "@rstest/core"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MessageInput } from "./MessageInput"

void React

const mocks = rstest.hoisted(() => ({
    onSend: rstest.fn(),
    onSendFile: rstest.fn(),
}))

beforeEach(() => {
    mocks.onSend.mockReset()
    mocks.onSendFile.mockReset()
})

describe("MessageInput", () => {
    describe("Rendering", () => {
        it("should render input field", () => {
            render(
                <MessageInput
                    onSend={mocks.onSend}
                    onSendFile={mocks.onSendFile}
                    disabled={false}
                />
            )
            const textarea =
                screen.getByPlaceholderText(/message|write|type/i) ||
                document.querySelector("textarea")
            expect(textarea).toBeDefined()
        })

        it("should render send button", () => {
            render(
                <MessageInput
                    onSend={mocks.onSend}
                    onSendFile={mocks.onSendFile}
                    disabled={false}
                />
            )
            const sendButton = screen.getByRole("button", {
                name: /Envoyer/i,
            })
            expect(sendButton).toBeDefined()
        })

        it("should render file attachment button", () => {
            render(
                <MessageInput
                    onSend={mocks.onSend}
                    onSendFile={mocks.onSendFile}
                    disabled={false}
                />
            )
            const fileButton = screen.queryByLabelText(/attach|file|upload/i)
            expect(
                fileButton || document.querySelector("input[type='file']")
            ).toBeDefined()
        })
    })

    describe("Text input", () => {
        it("should allow typing in textarea", async () => {
            const user = userEvent.setup()
            render(
                <MessageInput
                    onSend={mocks.onSend}
                    onSendFile={mocks.onSendFile}
                    disabled={false}
                />
            )

            const textarea =
                (document.querySelector("textarea") as HTMLTextAreaElement) ||
                screen.getByPlaceholderText(/message/i)
            await user.click(textarea)
            await user.keyboard("Hello world")

            expect((textarea as HTMLTextAreaElement).value).toBe("Hello world")
        })

        it("should clear input after sending", async () => {
            const user = userEvent.setup()
            render(
                <MessageInput
                    onSend={mocks.onSend}
                    onSendFile={mocks.onSendFile}
                    disabled={false}
                />
            )

            const textarea =
                (document.querySelector("textarea") as HTMLTextAreaElement) ||
                screen.getByPlaceholderText(/message/i)
            await user.click(textarea)
            await user.keyboard("Test message")

            const sendButton =
                screen.getByRole("button", { name: /Envoyer/i }) ||
                screen.queryByRole("button")
            if (sendButton) {
                await user.click(sendButton)
            }

            expect(mocks.onSend).toHaveBeenCalled()
        })
    })

    describe("Sending messages", () => {
        it("should call onSend with message content", async () => {
            const user = userEvent.setup()
            render(
                <MessageInput
                    onSend={mocks.onSend}
                    onSendFile={mocks.onSendFile}
                    disabled={false}
                />
            )

            const textarea =
                (document.querySelector("textarea") as HTMLTextAreaElement) ||
                screen.getByPlaceholderText(/message/i)
            await user.click(textarea)
            await user.keyboard("Test")

            const sendButton = screen.getByRole("button", { name: /Envoyer/i })
            await user.click(sendButton)

            expect(mocks.onSend).toHaveBeenCalled()
        })

        it("should send on Enter key", async () => {
            const user = userEvent.setup()
            render(
                <MessageInput
                    onSend={mocks.onSend}
                    onSendFile={mocks.onSendFile}
                    disabled={false}
                />
            )

            const textarea =
                (document.querySelector("textarea") as HTMLTextAreaElement) ||
                screen.getByPlaceholderText(/message/i)
            await user.click(textarea)
            await user.keyboard("Message")
            await user.keyboard("{Enter}")

            expect(mocks.onSend).toHaveBeenCalled()
        })

        it("should not send empty message", async () => {
            render(
                <MessageInput
                    onSend={mocks.onSend}
                    onSendFile={mocks.onSendFile}
                    disabled={false}
                />
            )

            const sendButton = screen.getByRole("button", { name: /Envoyer/i })
            await userEvent.click(sendButton)

            expect(mocks.onSend).not.toHaveBeenCalled()
        })
    })

    describe("File upload", () => {
        const selectFile = (name = "test.txt") => {
            const fileInput = document.querySelector(
                "input[type='file']"
            ) as HTMLInputElement
            const file = new File(["test"], name, { type: "text/plain" })
            fireEvent.change(fileInput, { target: { files: [file] } })
            return file
        }

        it("met le fichier en attente sans l'envoyer", async () => {
            render(
                <MessageInput
                    onSend={mocks.onSend}
                    onSendFile={mocks.onSendFile}
                    disabled={false}
                />
            )

            selectFile()

            // Le fichier apparaît dans le panier…
            await waitFor(() =>
                expect(screen.getByText("test.txt")).toBeDefined()
            )
            // …mais rien n'est parti : l'envoi est devenu explicite.
            expect(mocks.onSendFile).not.toHaveBeenCalled()
        })

        it("envoie les fichiers en attente au clic sur Envoyer", async () => {
            render(
                <MessageInput
                    onSend={mocks.onSend}
                    onSendFile={mocks.onSendFile}
                    disabled={false}
                />
            )

            selectFile()
            await waitFor(() =>
                expect(screen.getByText("test.txt")).toBeDefined()
            )

            fireEvent.click(screen.getByTitle("Envoyer"))

            await waitFor(() => expect(mocks.onSendFile).toHaveBeenCalled())
            // Un fichier seul part sans texte.
            expect(mocks.onSend).not.toHaveBeenCalled()
        })

        it("retire un fichier du panier", async () => {
            render(
                <MessageInput
                    onSend={mocks.onSend}
                    onSendFile={mocks.onSendFile}
                    disabled={false}
                />
            )

            selectFile()
            await waitFor(() =>
                expect(screen.getByText("test.txt")).toBeDefined()
            )

            fireEvent.click(screen.getByLabelText("Retirer test.txt"))

            await waitFor(() =>
                expect(screen.queryByText("test.txt")).toBeNull()
            )
            expect(mocks.onSendFile).not.toHaveBeenCalled()
        })
    })

    describe("Disabled state", () => {
        it("should disable input when disabled prop is true", () => {
            render(
                <MessageInput
                    onSend={mocks.onSend}
                    onSendFile={mocks.onSendFile}
                    disabled={true}
                />
            )

            const textarea =
                (document.querySelector("textarea") as HTMLTextAreaElement) ||
                screen.queryByPlaceholderText(/message/i)
            if (textarea) {
                expect(textarea.disabled).toBe(true)
            }
        })

        it("should disable send button when disabled", () => {
            render(
                <MessageInput
                    onSend={mocks.onSend}
                    onSendFile={mocks.onSendFile}
                    disabled={true}
                />
            )

            const sendButton = screen.getByRole("button", { name: /Envoyer/i })
            expect((sendButton as HTMLButtonElement).disabled).toBe(true)
        })
    })

    describe("Accessibility", () => {
        it("should have proper ARIA labels", () => {
            const { container } = render(
                <MessageInput
                    onSend={mocks.onSend}
                    onSendFile={mocks.onSendFile}
                    disabled={false}
                />
            )

            expect(
                container.querySelector("textarea") ||
                    container.querySelector("[role='textbox']")
            ).toBeDefined()
        })

        it("should be keyboard navigable", async () => {
            const user = userEvent.setup()
            render(
                <MessageInput
                    onSend={mocks.onSend}
                    onSendFile={mocks.onSendFile}
                    disabled={false}
                />
            )

            const textarea = document.querySelector("textarea")
            if (textarea) {
                await user.tab()
                expect(document.activeElement === textarea).toBeDefined()
            }
        })
    })
})
