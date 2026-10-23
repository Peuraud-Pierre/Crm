import { describe, it, expect } from "@rstest/core"
import {
    getMediaKind,
    getMediaUrl,
    isVisualMedia,
    resolveMessageMediaKind,
} from "./messageMedia"
import type { CryptedMessage } from "../hooks/useCryptedChat"

const message = (patch: Partial<CryptedMessage>): CryptedMessage =>
    ({
        id: 1,
        chatId: "c",
        senderId: "s",
        recipientId: null,
        body: "",
        createdAt: new Date().toISOString(),
        isMine: false,
        ...patch,
    }) as CryptedMessage

describe("getMediaKind", () => {
    it("classe les familles rendues nativement", () => {
        expect(getMediaKind("image/jpeg")).toBe("image")
        expect(getMediaKind("image/png")).toBe("image")
        expect(getMediaKind("image/webp")).toBe("image")
        expect(getMediaKind("image/gif")).toBe("image")
        expect(getMediaKind("video/mp4")).toBe("video")
        expect(getMediaKind("video/webm")).toBe("video")
        expect(getMediaKind("audio/mpeg")).toBe("audio")
    })

    it("ignore les paramètres et la casse du MIME", () => {
        expect(getMediaKind("VIDEO/MP4; codecs=avc1")).toBe("video")
        expect(getMediaKind("  image/JPEG  ")).toBe("image")
    })

    it("écarte les formats que le navigateur ne rend pas", () => {
        // Sans cette liste, un .mov ou un HEIC affichait un lecteur vide ou une
        // image cassée selon le navigateur, au lieu d'un lien de téléchargement.
        expect(getMediaKind("video/quicktime")).toBeNull()
        expect(getMediaKind("image/heic")).toBeNull()
        expect(getMediaKind("video/x-matroska")).toBeNull()
    })

    it("laisse les documents à la ligne de fichier", () => {
        expect(getMediaKind("application/pdf")).toBeNull()
        expect(getMediaKind(null)).toBeNull()
        expect(getMediaKind(undefined)).toBeNull()
    })
})

describe("isVisualMedia", () => {
    it("ne retient que ce qui entre dans une mosaïque", () => {
        expect(isVisualMedia("image/png")).toBe(true)
        expect(isVisualMedia("video/mp4")).toBe(true)
        expect(isVisualMedia("audio/mpeg")).toBe(false)
        expect(isVisualMedia("application/pdf")).toBe(false)
    })
})

describe("getMediaUrl", () => {
    it("trouve le blob quelle que soit la case où le hook l'a rangé", () => {
        expect(getMediaUrl(message({ image_url: "blob:i" }))).toBe("blob:i")
        // Une vidéo atterrit dans file_url : elle n'était rendue que comme un
        // lien de téléchargement.
        expect(getMediaUrl(message({ file_url: "blob:f" }))).toBe("blob:f")
        expect(getMediaUrl(message({}))).toBeUndefined()
    })
})

describe("resolveMessageMediaKind", () => {
    it("retombe sur image quand le MIME manque mais que l'URL image existe", () => {
        expect(
            resolveMessageMediaKind(message({ image_url: "blob:i" }))
        ).toBe("image")
    })

    it("laisse primer le MIME quand il est présent", () => {
        expect(
            resolveMessageMediaKind(
                message({ file_url: "blob:v", file_mime: "video/mp4" })
            )
        ).toBe("video")
    })
})
