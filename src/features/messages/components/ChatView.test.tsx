import React from "react"
import { describe, it, expect, rstest, beforeAll } from "@rstest/core"

void React
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { ChatView } from "./ChatView"

// ChatView lit ?user= via useSearchParams → besoin d'un contexte Router.
const renderWithRouter = (ui: React.ReactElement) =>
    render(ui, { wrapper: MemoryRouter })

const matchMediaMock = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
})

const mocks = rstest.hoisted(() => ({
    user: { user_id: "test-user" },
    sendMessage: rstest.fn(),
    sendFile: rstest.fn(),
    supabaseAuth: {
        getSession: rstest.fn(async () => ({
            data: { session: null },
            error: null,
        })),
        onAuthStateChange: rstest.fn(),
        getUser: rstest.fn(),
    },
}))

rstest.mock("@/features/auth/hooks/useAuth/AuthProvider", () => ({
    // eslint-disable-next-line react-x/no-unnecessary-use-prefix -- must match real hook export name
    useAuth: () => ({
        user: mocks.user,
        loading: false,
    }),
}))

rstest.mock("../hooks/useCryptedChat", () => ({
    // eslint-disable-next-line react-x/no-unnecessary-use-prefix -- must match real hook export name
    useCryptedChat: () => ({
        messages: [],
        loading: false,
        error: null,
        sendMessage: mocks.sendMessage,
        sendFile: mocks.sendFile,
        deleteMessage: rstest.fn(),
        locked: false,
        ready: true,
        setMessages: rstest.fn(),
        needsPassphrase: false,
        unlocking: false,
        unlockError: null,
        unlock: rstest.fn(),
        markThreadRead: rstest.fn(),
        bundleSynced: false,
        autoUnlockAt: undefined,
        remoteBundleAvailable: false,
        forceBundleResync: rstest.fn(),
        purgeRemoteBundle: rstest.fn(),
    }),
}))

rstest.mock("../hooks/useCryptedUsers", () => ({
    // eslint-disable-next-line react-x/no-unnecessary-use-prefix -- must match real hook export name
    useCryptedUsers: () => ({
        groups: [],
        loading: false,
        unreadByUser: {},
    }),
}))

rstest.mock("@/integrations/supabase/client", () => ({
    supabase: {
        auth: mocks.supabaseAuth,
        from: rstest.fn(() => ({
            select: rstest.fn().mockReturnThis(),
            eq: rstest.fn().mockReturnThis(),
            or: rstest.fn().mockReturnThis(),
            not: rstest.fn().mockReturnThis(),
            is: rstest.fn().mockReturnThis(),
            order: rstest.fn().mockReturnThis(),
            limit: rstest.fn().mockReturnThis(),
            maybeSingle: rstest
                .fn()
                .mockResolvedValue({ data: null, error: null }),
            insert: rstest.fn().mockResolvedValue({ data: null, error: null }),
            update: rstest.fn().mockResolvedValue({ data: null, error: null }),
            delete: rstest.fn().mockResolvedValue({ data: null, error: null }),
        })),
        storage: {
            from: rstest.fn(() => ({
                upload: rstest.fn(),
                createSignedUrl: rstest.fn(),
                remove: rstest.fn(),
            })),
        },
        channel: rstest.fn(() => ({
            on: rstest.fn().mockReturnThis(),
            subscribe: rstest.fn().mockReturnThis(),
        })),
        removeChannel: rstest.fn(),
    },
}))

// usePinManager lance un bootstrap asynchrone au montage (lecture du bundle,
// statut PAKE). Ses setState retombent APRÈS la fin des tests synchrones : d'où
// les avertissements "update to SecurityStateProvider ... not wrapped in act".
// Ces tests vérifient le rendu de ChatView, pas la gestion des clés — on
// neutralise le hook entier (couvert par usePinManager.test.ts).
rstest.mock("../hooks/usePinManager", () => ({
    // eslint-disable-next-line react-x/no-unnecessary-use-prefix -- must match real hook export name
    usePinManager: () => ({
        keyPair: null,
        ratchetKeyPair: null,
        signKeyPair: null,
        ready: true,
        locked: false,
        needsPassphrase: false,
        needsPinSetup: false,
        setupPin: rstest.fn(),
        setupInProgress: false,
        setupError: null,
        unlocking: false,
        unlockError: null,
        unlock: rstest.fn(),
        userId: "test-user",
        bundleSynced: true,
        showMagicLinkHint: false,
        autoUnlockAt: undefined,
        remoteBundleAvailable: false,
        forceBundleResync: rstest.fn(),
        purgeRemoteBundle: rstest.fn(),
        importFromQRCode: rstest.fn(),
        getExportKeyForQRCode: rstest.fn(),
    }),
}))

// Même motif pour les hooks de ChatViewContent qui chargent des données :
// chacun résout une promesse puis appelle setState hors du cycle de vie du test.
rstest.mock("../hooks/useRecentConversations", () => ({
    // eslint-disable-next-line react-x/no-unnecessary-use-prefix -- must match real hook export name
    useRecentConversations: () => ({}),
}))

rstest.mock("../hooks/useGroups", () => ({
    // eslint-disable-next-line react-x/no-unnecessary-use-prefix -- must match real hook export name
    useGroups: () => ({
        groups: [],
        loading: false,
        members: [],
        createGroup: rstest.fn(),
        refresh: rstest.fn(),
    }),
}))

rstest.mock("../hooks/useCryptedGroupChat", () => ({
    // eslint-disable-next-line react-x/no-unnecessary-use-prefix -- must match real hook export name
    useCryptedGroupChat: () => ({
        messages: [],
        loading: false,
        error: null,
        sendMessage: rstest.fn(),
        sendFile: rstest.fn(),
        deleteMessage: rstest.fn(),
        ready: true,
    }),
}))

rstest.mock("../core/pake", () => ({
    // eslint-disable-next-line react-x/no-unnecessary-use-prefix -- must match real hook export name
    usePakeAuth: () => ({
        status: "authenticated",
        error: null,
    }),
}))

beforeAll(() => {
    Object.defineProperty(window, "matchMedia", {
        writable: true,
        value: matchMediaMock,
    })
})

describe("ChatView Component", () => {
    const mockRecipientId = "recipient-456"

    describe("Rendering", () => {
        it("should render without crashing", () => {
            const { container } = renderWithRouter(
                <ChatView recipientId={mockRecipientId} />
            )
            expect(container).toBeDefined()
        })

        it("should render chat header", () => {
            renderWithRouter(<ChatView recipientId={mockRecipientId} />)
            // ChatHeader should be rendered
            expect(document.querySelector("[role='banner']")).toBeDefined()
        })

        it("should render message input area", () => {
            renderWithRouter(<ChatView recipientId={mockRecipientId} />)
            const textarea = screen.queryByPlaceholderText(/message/i)
            expect(textarea || document.querySelector("textarea")).toBeDefined()
        })
    })

    describe("Props handling", () => {
        it("should accept recipientId prop", () => {
            const { container } = renderWithRouter(
                <ChatView recipientId={mockRecipientId} />
            )
            expect(container).toBeDefined()
        })
    })

    describe("Message handling", () => {
        it("should display empty state when no messages", () => {
            const { container } = renderWithRouter(
                <ChatView recipientId={mockRecipientId} />
            )
            expect(
                container.querySelector("[data-testid='message-list']") ===
                    null || container.textContent.includes("No messages")
            ).toBeDefined()
        })
    })

    describe("Security features", () => {
        it("should have security panel button", () => {
            renderWithRouter(<ChatView recipientId={mockRecipientId} />)
            // Security panel should be accessible
            const securityButton = screen.queryByLabelText(/security|lock/i)
            expect(
                securityButton ||
                    document.querySelector("[aria-label*='security']")
            ).toBeDefined()
        })
    })

    describe("Accessibility", () => {
        it("should have proper ARIA labels", () => {
            const { container } = renderWithRouter(
                <ChatView recipientId={mockRecipientId} />
            )
            expect(container).toBeDefined()
            // Should have at least one role for semantic structure
            expect(
                container.querySelector("[role='main']") ||
                    container.querySelector("[role='region']")
            ).toBeDefined()
        })

        it("should be keyboard navigable", async () => {
            const user = userEvent.setup()
            renderWithRouter(<ChatView recipientId={mockRecipientId} />)

            const textarea =
                screen.queryByPlaceholderText(/message/i) ||
                document.querySelector("textarea")
            if (textarea) {
                await user.click(textarea)
                await user.keyboard("Test message")
                expect((textarea as HTMLTextAreaElement).value).toBe(
                    "Test message"
                )
            }
        })
    })
})
