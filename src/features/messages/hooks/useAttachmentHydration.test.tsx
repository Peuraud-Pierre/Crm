import React from "react"
import { describe, it, expect, rstest, beforeEach, afterEach } from "@rstest/core"
import { renderHook, act, waitFor } from "@testing-library/react"

void React

const downloadAttachment = rstest.fn()
const decryptAttachmentPayload = rstest.fn()

rstest.mock("../services/cryptedMessagesService", () => ({
    downloadAttachment: (...args: unknown[]) => downloadAttachment(...args),
}))

rstest.mock("../core/crypto", () => ({
    decryptAttachmentPayload: (...args: unknown[]) =>
        decryptAttachmentPayload(...args),
}))

const { useAttachmentHydration, isAttachmentPending } = await import(
    "./useAttachmentHydration"
)
type Message = Parameters<typeof isAttachmentPending>[0]

function pendingMessage(id: number): Message {
    return {
        id,
        chatId: "group:g1",
        senderId: "other",
        recipientId: null,
        body: "",
        createdAt: new Date(2026, 8, 1, 10, id).toISOString(),
        isMine: false,
        file_mime: "application/pdf",
        file_name: `doc-${id}.pdf`,
        storage_bucket: "cryptedmessage",
        storage_path: `path/${id}`,
        iv_b64: "iv",
        // Le contenu de `meta` n'importe pas : le déchiffrement est mocké.
        meta: { algo: "nacl-secretbox-v1" } as Message["meta"],
    } as Message
}

const keyPair = { publicKey: "pub", secretKey: "sec" }

function setup(messages: Message[], conversationKey = "conv-1") {
    const setMessages = rstest.fn()
    const view = renderHook(
        (props: { conversationKey: string } = { conversationKey }) =>
        useAttachmentHydration({
            conversationKey: props.conversationKey,
            messages,
            keyPair: keyPair as never,
            userId: "me",
            setMessages,
            trackObjectUrl: () => {},
        }),
        { initialProps: { conversationKey } }
    )
    return { ...view, setMessages }
}

describe("isAttachmentPending", () => {
    it("ne retient que les pièces jointes ni résolues ni en erreur", () => {
        const base = pendingMessage(1)
        expect(isAttachmentPending(base)).toBe(true)
        expect(isAttachmentPending({ ...base, file_url: "blob:x" })).toBe(false)
        expect(isAttachmentPending({ ...base, image_url: "blob:x" })).toBe(
            false
        )
        expect(
            isAttachmentPending({ ...base, attachment_error: "raté" })
        ).toBe(false)
        expect(isAttachmentPending({ ...base, storage_path: null })).toBe(false)
    })
})

describe("useAttachmentHydration", () => {
    beforeEach(() => {
        downloadAttachment.mockReset()
        decryptAttachmentPayload.mockReset()
        // Un échec de téléchargement suffit : on mesure la stratégie d'appel,
        // pas le déchiffrement (couvert par les tests crypto existants).
        downloadAttachment.mockResolvedValue({ data: null, error: "boom" })
        // …que le hook journalise : log attendu, sans intérêt pour ces tests.
        rstest.spyOn(console, "error").mockImplementation(() => {})
    })

    afterEach(() => {
        rstest.mocked(console.error).mockRestore()
    })

    it("ne télécharge rien tant que la pièce jointe n'est pas réclamée", () => {
        setup([pendingMessage(1), pendingMessage(2)])
        expect(downloadAttachment).not.toHaveBeenCalled()
    })

    it("ne télécharge qu'une fois par message, même réclamé plusieurs fois", async () => {
        const { result } = setup([pendingMessage(1)])

        act(() => {
            result.current.requestAttachment(1)
            result.current.requestAttachment(1)
            result.current.requestAttachment(1)
        })

        await waitFor(() =>
            expect(downloadAttachment).toHaveBeenCalledTimes(1)
        )
    })

    it("redemande les pièces jointes au retour dans une conversation", async () => {
        const { result, rerender } = setup([pendingMessage(1)], "conv-1")

        act(() => result.current.requestAttachment(1))
        await waitFor(() => expect(downloadAttachment).toHaveBeenCalledTimes(1))

        // On quitte le fil puis on y revient : `decryptRow` reconstruit des
        // messages sans blob (le fichier vit dans Storage), donc ils
        // repassent « en attente ». Sans purge de la mémoire des demandes,
        // ils restaient en squelette indéfiniment.
        rerender({ conversationKey: "conv-2" })
        rerender({ conversationKey: "conv-1" })

        act(() => result.current.requestAttachment(1))
        await waitFor(() => expect(downloadAttachment).toHaveBeenCalledTimes(2))
    })

    it("plafonne le nombre de téléchargements simultanés", async () => {
        const messages = Array.from({ length: 8 }, (_, i) =>
            pendingMessage(i + 1)
        )
        let inFlight = 0
        let peak = 0
        const release: Array<() => void> = []
        downloadAttachment.mockImplementation(() => {
            inFlight += 1
            peak = Math.max(peak, inFlight)
            return new Promise((resolve) => {
                release.push(() => {
                    inFlight -= 1
                    resolve({ data: null, error: "boom" })
                })
            })
        })

        const { result } = setup(messages)
        act(() => {
            for (const message of messages) {
                result.current.requestAttachment(message.id)
            }
        })

        await waitFor(() => expect(release.length).toBe(3))
        // Le code précédent bouclait en série (1 à la fois) sur TOUT
        // l'historique ; ici la file est parallèle mais bornée.
        expect(peak).toBe(3)

        await act(async () => {
            for (const done of [...release]) done()
        })
        await waitFor(() =>
            expect(downloadAttachment.mock.calls.length).toBeGreaterThan(3)
        )
    })
})
