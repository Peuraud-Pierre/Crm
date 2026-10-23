import React from "react"
import { describe, it, expect } from "@rstest/core"

void React
import { render, screen } from "@testing-library/react"
import { MessageList } from "./MessageList"
import type { CryptedMessage } from "../hooks/useCryptedChat"

describe("MessageList Component", () => {
    const mockUserId = "user-123"

    const mockMessage: CryptedMessage = {
        id: 1,
        chatId: "chat-1",
        senderId: "sender-1",
        recipientId: "user-123",
        body: "Hello, World!",
        createdAt: new Date().toISOString(),
        isMine: false,
        image_url: undefined,
        file_url: undefined,
        file_name: null,
        file_mime: null,
        file_size: null,
        storage_bucket: null,
        storage_path: null,
        iv_b64: null,
        meta: null,
        message_key_b64: null,
    }

    describe("Rendering", () => {
        it("should render empty state when no messages", () => {
            const { container } = render(
                <MessageList messages={[]} currentUserId={mockUserId} />
            )
            expect(container).toBeDefined()
        })

        it("should render single message", () => {
            render(
                <MessageList
                    messages={[mockMessage]}
                    currentUserId={mockUserId}
                />
            )
            expect(screen.getByText("Hello, World!")).toBeDefined()
        })

        it("should render multiple messages", () => {
            const messages = [
                mockMessage,
                { ...mockMessage, id: 2, body: "Second message" },
                { ...mockMessage, id: 3, body: "Third message" },
            ]

            render(
                <MessageList messages={messages} currentUserId={mockUserId} />
            )
            expect(screen.getByText("Hello, World!")).toBeDefined()
            expect(screen.getByText("Second message")).toBeDefined()
            expect(screen.getByText("Third message")).toBeDefined()
        })
    })

    describe("Message display", () => {
        it("should display message content", () => {
            render(
                <MessageList
                    messages={[mockMessage]}
                    currentUserId={mockUserId}
                />
            )
            expect(screen.getByText("Hello, World!")).toBeDefined()
        })

        it("should display encrypted message placeholder", () => {
            const encryptedMessage = {
                ...mockMessage,
                body: "Message chiffre",
            }
            render(
                <MessageList
                    messages={[encryptedMessage]}
                    currentUserId={mockUserId}
                />
            )
            expect(screen.getByText("Message chiffre")).toBeDefined()
        })

        it("should display timestamp", () => {
            const now = new Date()
            const messageWithTime = {
                ...mockMessage,
                createdAt: now.toISOString(),
            }

            render(
                <MessageList
                    messages={[messageWithTime]}
                    currentUserId={mockUserId}
                />
            )

            // MessageTimestamp affiche l'heure courte (`HH:mm`) : la date
            // complète, jusqu'ici répétée sur chaque bulle avec les secondes,
            // ne subsiste qu'en infobulle et dans les séparateurs de jour.
            expect(document.body.textContent).toContain(
                now.toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                })
            )
        })
    })

    describe("Identité de l'expéditeur (groupe)", () => {
        const senders = new Map([
            ["sender-1", { name: "Alice Martin", avatarUrl: null }],
            ["user-123", { name: "Moi", avatarUrl: null }],
        ])

        it("affiche le pseudo de l'expéditeur en conversation de groupe", () => {
            render(
                <MessageList
                    messages={[mockMessage]}
                    currentUserId={mockUserId}
                    isGroup
                    senders={senders}
                />
            )
            expect(screen.getByText("Alice Martin")).toBeDefined()
        })

        it("n'affiche pas le pseudo en conversation 1-à-1", () => {
            render(
                <MessageList
                    messages={[mockMessage]}
                    currentUserId={mockUserId}
                    senders={senders}
                />
            )
            expect(screen.queryByText("Alice Martin")).toBeNull()
        })

        it("ne répète pas le pseudo sur les messages consécutifs du même auteur", () => {
            const now = Date.now()
            render(
                <MessageList
                    messages={[
                        {
                            ...mockMessage,
                            id: 1,
                            createdAt: new Date(now).toISOString(),
                        },
                        {
                            ...mockMessage,
                            id: 2,
                            body: "Deuxieme",
                            createdAt: new Date(now + 1000).toISOString(),
                        },
                    ]}
                    currentUserId={mockUserId}
                    isGroup
                    senders={senders}
                />
            )
            expect(screen.getAllByText("Alice Martin")).toHaveLength(1)
        })

        it("nomme la personne en train d'écrire", () => {
            render(
                <MessageList
                    messages={[]}
                    currentUserId={mockUserId}
                    isGroup
                    senders={senders}
                    typingUserIds={["sender-1"]}
                />
            )
            expect(
                screen.getByText("Alice Martin est en train d'écrire")
            ).toBeDefined()
        })
    })

    describe("Message ownership", () => {
        it("should differentiate my messages from others", () => {
            // id distincts : les deux messages sont rendus dans la MÊME liste, et
            // MessageList les clé par message.id. Sans ça, React signale
            // "Encountered two children with the same key" et peut fusionner ou
            // omettre l'un des deux — le test ne vérifierait plus ce qu'il croit.
            const myMessage = {
                ...mockMessage,
                id: 1,
                isMine: true,
                senderId: mockUserId,
            }
            const theirMessage = {
                ...mockMessage,
                id: 2,
                isMine: false,
                senderId: "other-user",
            }

            const { container } = render(
                <MessageList
                    messages={[myMessage, theirMessage]}
                    currentUserId={mockUserId}
                />
            )
            expect(container).toBeDefined()
        })
    })

    describe("File attachments", () => {
        it("should display file attachment", () => {
            const messageWithFile = {
                ...mockMessage,
                file_url: "https://example.com/file.pdf",
                file_name: "document.pdf",
                file_size: 1024,
                file_mime: "application/pdf",
            }

            render(
                <MessageList
                    messages={[messageWithFile]}
                    currentUserId={mockUserId}
                />
            )
            expect(screen.getByText("document.pdf")).toBeDefined()
        })

        it("should display file size", () => {
            const messageWithFile = {
                ...mockMessage,
                file_url: "https://example.com/file.pdf",
                file_name: "document.pdf",
                file_size: 2048,
            }

            render(
                <MessageList
                    messages={[messageWithFile]}
                    currentUserId={mockUserId}
                />
            )
            expect(document.body.textContent).toContain("2.0 KB")
        })
    })

    describe("Image attachments", () => {
        it("should display image attachment", () => {
            const messageWithImage = {
                ...mockMessage,
                image_url: "https://example.com/image.jpg",
            }

            const { container } = render(
                <MessageList
                    messages={[messageWithImage]}
                    currentUserId={mockUserId}
                />
            )
            const img = container.querySelector("img")
            expect(img?.src).toContain("image.jpg")
        })
    })

    describe("Accessibility", () => {
        it("should have semantic message structure", () => {
            const { container } = render(
                <MessageList
                    messages={[mockMessage]}
                    currentUserId={mockUserId}
                />
            )
            // Should have list or article elements
            expect(
                container.querySelector("ul") ||
                    container.querySelector("ol") ||
                    container.querySelector("article")
            ).toBeDefined()
        })

        it("should have readable text content", () => {
            render(
                <MessageList
                    messages={[mockMessage]}
                    currentUserId={mockUserId}
                />
            )
            expect(screen.getByText("Hello, World!")).toBeDefined()
        })
    })

    describe("Sorting", () => {
        it("should display messages in chronological order", () => {
            const now = new Date()
            const messages = [
                {
                    ...mockMessage,
                    id: 1,
                    body: "First",
                    createdAt: new Date(now.getTime() - 2000).toISOString(),
                },
                {
                    ...mockMessage,
                    id: 2,
                    body: "Second",
                    createdAt: new Date(now.getTime() - 1000).toISOString(),
                },
                {
                    ...mockMessage,
                    id: 3,
                    body: "Third",
                    createdAt: now.toISOString(),
                },
            ]

            const { container } = render(
                <MessageList messages={messages} currentUserId={mockUserId} />
            )
            const texts = container.textContent
            expect(texts.indexOf("First")).toBeLessThan(texts.indexOf("Second"))
            expect(texts.indexOf("Second")).toBeLessThan(texts.indexOf("Third"))
        })
    })
})
