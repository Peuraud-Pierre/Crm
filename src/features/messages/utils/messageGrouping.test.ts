import { describe, it, expect } from "@rstest/core"
import { buildMessageItems, RUN_BREAK_MS } from "./messageGrouping"
import type { CryptedMessage } from "../hooks/useCryptedChat"

const ME = "me-1"
const OTHER = "other-1"

function msg(
    id: number,
    senderId: string,
    createdAt: string
): CryptedMessage {
    return {
        id,
        chatId: "group:g1",
        senderId,
        recipientId: null,
        body: `m${id}`,
        createdAt,
        isMine: senderId === ME,
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
    } as CryptedMessage
}

const messagesOnly = (items: ReturnType<typeof buildMessageItems>) =>
    items.filter((i) => i.kind === "message")

describe("buildMessageItems", () => {
    it("n'affiche le pseudo qu'en tête de salve", () => {
        const base = new Date("2026-09-01T10:00:00.000Z")
        const items = messagesOnly(
            buildMessageItems(
                [
                    msg(1, OTHER, base.toISOString()),
                    msg(2, OTHER, new Date(base.getTime() + 1000).toISOString()),
                ],
                { isGroup: true, currentUserId: ME }
            )
        )

        expect(items).toHaveLength(2)
        expect(items[0].showSender).toBe(true)
        expect(items[0].isFirstOfRun).toBe(true)
        expect(items[0].isLastOfRun).toBe(false)
        expect(items[1].showSender).toBe(false)
        expect(items[1].isLastOfRun).toBe(true)
    })

    it("ouvre une nouvelle salve quand l'expéditeur change", () => {
        const base = new Date("2026-09-01T10:00:00.000Z")
        const items = messagesOnly(
            buildMessageItems(
                [
                    msg(1, OTHER, base.toISOString()),
                    msg(2, ME, new Date(base.getTime() + 1000).toISOString()),
                    msg(3, OTHER, new Date(base.getTime() + 2000).toISOString()),
                ],
                { isGroup: true, currentUserId: ME }
            )
        )

        expect(items.map((i) => i.isFirstOfRun)).toEqual([true, true, true])
        // Le message de l'utilisateur courant n'affiche jamais son propre nom.
        expect(items.map((i) => i.showSender)).toEqual([true, false, true])
    })

    it("coupe la salve au-delà du seuil de temps", () => {
        const base = new Date("2026-09-01T10:00:00.000Z")
        const items = messagesOnly(
            buildMessageItems(
                [
                    msg(1, OTHER, base.toISOString()),
                    msg(
                        2,
                        OTHER,
                        new Date(base.getTime() + RUN_BREAK_MS + 1).toISOString()
                    ),
                ],
                { isGroup: true, currentUserId: ME }
            )
        )

        expect(items[1].isFirstOfRun).toBe(true)
        expect(items[1].showSender).toBe(true)
        expect(items[0].isLastOfRun).toBe(true)
    })

    it("insère un séparateur par jour civil et repart en tête de salve", () => {
        const items = buildMessageItems(
            [
                msg(1, OTHER, "2026-09-01T10:00:00.000Z"),
                msg(2, OTHER, "2026-09-02T10:00:00.000Z"),
            ],
            { isGroup: true, currentUserId: ME }
        )

        expect(items.filter((i) => i.kind === "day")).toHaveLength(2)
        expect(items[0].kind).toBe("day")
        // Malgré le même expéditeur, le passage au jour suivant rouvre la salve.
        expect(messagesOnly(items)[1].isFirstOfRun).toBe(true)
    })

    it("n'affiche jamais le pseudo en conversation 1-à-1", () => {
        const base = new Date("2026-09-01T10:00:00.000Z")
        const items = messagesOnly(
            buildMessageItems(
                [
                    msg(1, OTHER, base.toISOString()),
                    msg(2, ME, new Date(base.getTime() + 1000).toISOString()),
                ],
                { isGroup: false, currentUserId: ME }
            )
        )

        expect(items.every((i) => !i.showSender)).toBe(true)
    })

    it("renvoie une liste vide sans message", () => {
        expect(buildMessageItems([], { isGroup: true })).toEqual([])
    })
})

describe("buildMessageItems — mosaïques", () => {
    const media = (
        id: number,
        senderId: string,
        createdAt: string,
        mime = "image/jpeg"
    ) => ({ ...msg(id, senderId, createdAt), file_mime: mime })

    it("regroupe les médias consécutifs d'un même expéditeur", () => {
        const base = new Date("2026-09-01T10:00:00.000Z")
        const items = buildMessageItems(
            [
                media(1, OTHER, base.toISOString()),
                media(2, OTHER, new Date(base.getTime() + 1000).toISOString()),
                media(3, OTHER, new Date(base.getTime() + 2000).toISOString()),
            ],
            { isGroup: true, currentUserId: ME }
        )

        const albums = items.filter((i) => i.kind === "album")
        expect(albums).toHaveLength(1)
        expect(albums[0].kind === "album" && albums[0].messages).toHaveLength(3)
        // Le nom n'apparaît qu'une fois, en tête de mosaïque.
        expect(albums[0].kind === "album" && albums[0].showSender).toBe(true)
    })

    it("laisse un média isolé en bulle normale", () => {
        const items = buildMessageItems(
            [media(1, OTHER, "2026-09-01T10:00:00.000Z")],
            { isGroup: true, currentUserId: ME }
        )
        expect(items.some((i) => i.kind === "album")).toBe(false)
    })

    it("mélange images et vidéos dans la même mosaïque", () => {
        const base = new Date("2026-09-01T10:00:00.000Z")
        const items = buildMessageItems(
            [
                media(1, OTHER, base.toISOString(), "image/png"),
                media(
                    2,
                    OTHER,
                    new Date(base.getTime() + 1000).toISOString(),
                    "video/mp4"
                ),
            ],
            { isGroup: true, currentUserId: ME }
        )
        const album = items.find((i) => i.kind === "album")
        expect(album?.kind === "album" && album.messages).toHaveLength(2)
    })

    it("n'avale ni le texte, ni les documents, ni les médias supprimés", () => {
        const base = new Date("2026-09-01T10:00:00.000Z")
        const items = buildMessageItems(
            [
                media(1, OTHER, base.toISOString()),
                // Un PDF garde sa ligne de fichier : il coupe la mosaïque.
                {
                    ...msg(2, OTHER, new Date(base.getTime() + 1000).toISOString()),
                    file_mime: "application/pdf",
                },
                media(3, OTHER, new Date(base.getTime() + 2000).toISOString()),
            ],
            { isGroup: true, currentUserId: ME }
        )
        expect(items.some((i) => i.kind === "album")).toBe(false)
    })

    it("coupe la mosaïque au changement de salve", () => {
        const base = new Date("2026-09-01T10:00:00.000Z")
        const items = buildMessageItems(
            [
                media(1, OTHER, base.toISOString()),
                media(
                    2,
                    OTHER,
                    new Date(base.getTime() + RUN_BREAK_MS + 1).toISOString()
                ),
            ],
            { isGroup: true, currentUserId: ME }
        )
        expect(items.some((i) => i.kind === "album")).toBe(false)
    })
})
