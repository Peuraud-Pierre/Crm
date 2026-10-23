// ── imageResize.test.ts ───────────────────────────────────────────────────────
// Tests unitaires de resizeImageToMaxHeight. jsdom n'implémente ni
// createImageBitmap ni un vrai contexte canvas 2D — ces deux API navigateur
// sont donc simulées ici (bitmap factice avec width/height connus, canvas
// factice qui capture les appels à drawImage/toBlob) pour vérifier la LOGIQUE
// (calcul du ratio, pas d'agrandissement, conservation du nom/type, fermeture
// du bitmap) indépendamment du rendu réel. Le composant appelant
// (ThematiqueFormDialog) mocke ce module en bloc plutôt que de dépendre de ces
// simulations — voir ThematiqueFormDialog.upload.test.tsx.

import { describe, expect, test, rstest, beforeEach, afterEach } from "@rstest/core"
import { resizeImageToMaxHeight, sniffImageMime, THEMATIQUE_IMAGE_MAX_HEIGHT } from "./imageResize"

function mockBitmap(width: number, height: number) {
    return { width, height, close: rstest.fn() }
}

const originalCreateElement = document.createElement.bind(document)
const originalCreateImageBitmap = globalThis.createImageBitmap

function stubCanvas(overrides: { drawImage?: (...args: unknown[]) => void; toBlob?: (cb: (b: Blob | null) => void) => void; getContext?: () => unknown } = {}) {
    const drawImage = overrides.drawImage ?? rstest.fn()
    const toBlob = overrides.toBlob ?? ((cb: (b: Blob | null) => void) => cb(new Blob(["resized"], { type: "image/png" })))
    const ctx = { drawImage }
    const fakeCanvas = {
        width: 0,
        height: 0,
        getContext: overrides.getContext ?? (() => ctx),
        toBlob,
    }
    document.createElement = ((tag: string) => {
        if (tag === "canvas") return fakeCanvas as unknown as HTMLCanvasElement
        return originalCreateElement(tag)
    }) as typeof document.createElement
    return { drawImage, fakeCanvas }
}

beforeEach(() => {
    rstest.clearAllMocks()
})

afterEach(() => {
    document.createElement = originalCreateElement
    globalThis.createImageBitmap = originalCreateImageBitmap
})

describe("resizeImageToMaxHeight", () => {
    // Le ré-encodage est la mesure de sécurité du champ image : renvoyer le
    // fichier d'origine, même à la bonne taille, enverrait ses octets tels
    // quels à Storage.
    test("ré-encode même une image déjà sous la hauteur maximale", async () => {
        const file = new File(["x"], "small.png", { type: "image/png" })
        const bitmap = mockBitmap(300, 150)
        globalThis.createImageBitmap = rstest.fn().mockResolvedValue(bitmap)
        const { drawImage } = stubCanvas()

        const result = await resizeImageToMaxHeight(file, THEMATIQUE_IMAGE_MAX_HEIGHT)

        expect(result).not.toBe(file)
        expect(drawImage).toHaveBeenCalled()
        expect(bitmap.close).toHaveBeenCalledTimes(1)
    })

    test("n'agrandit jamais : la hauteur d'origine est conservée si elle est plus petite", async () => {
        const file = new File(["x"], "small.png", { type: "image/png" })
        globalThis.createImageBitmap = rstest.fn().mockResolvedValue(mockBitmap(300, 150))
        const { fakeCanvas } = stubCanvas()

        await resizeImageToMaxHeight(file, THEMATIQUE_IMAGE_MAX_HEIGHT)

        expect(fakeCanvas.width).toBe(300)
        expect(fakeCanvas.height).toBe(150)
    })

    test("ré-encode à l'identique quand la hauteur égale exactement le maximum", async () => {
        const file = new File(["x"], "exact.png", { type: "image/png" })
        globalThis.createImageBitmap = rstest.fn().mockResolvedValue(mockBitmap(400, 200))
        const { fakeCanvas } = stubCanvas()

        const result = await resizeImageToMaxHeight(file, 200)

        expect(result).not.toBe(file)
        expect(fakeCanvas.width).toBe(400)
        expect(fakeCanvas.height).toBe(200)
    })

    test("redimensionne en conservant le ratio d'aspect quand la hauteur dépasse le maximum", async () => {
        const file = new File(["x"], "big.png", { type: "image/png" })
        // Ratio 2:1 — hauteur 400 vers 200 => largeur attendue 400
        const bitmap = mockBitmap(800, 400)
        globalThis.createImageBitmap = rstest.fn().mockResolvedValue(bitmap)
        const { drawImage, fakeCanvas } = stubCanvas()

        const result = await resizeImageToMaxHeight(file, 200)

        expect(fakeCanvas.width).toBe(400)
        expect(fakeCanvas.height).toBe(200)
        expect(drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 400, 200)
        expect(result).not.toBe(file)
        expect(bitmap.close).toHaveBeenCalledTimes(1)
    })

    test("conserve le nom de fichier d'origine et le type mime produit par l'encodage", async () => {
        const file = new File(["x"], "photo-livraison.png", { type: "image/png" })
        globalThis.createImageBitmap = rstest.fn().mockResolvedValue(mockBitmap(600, 300))
        stubCanvas({ toBlob: (cb) => cb(new Blob(["r"], { type: "image/png" })) })

        const result = await resizeImageToMaxHeight(file, 150)

        expect(result.name).toBe("photo-livraison.png")
        expect(result.type).toBe("image/png")
    })

    test("utilise 200 comme hauteur maximale par défaut", async () => {
        const file = new File(["x"], "big.png", { type: "image/png" })
        const bitmap = mockBitmap(1000, 500)
        globalThis.createImageBitmap = rstest.fn().mockResolvedValue(bitmap)
        const { fakeCanvas } = stubCanvas()

        await resizeImageToMaxHeight(file)

        expect(fakeCanvas.height).toBe(THEMATIQUE_IMAGE_MAX_HEIGHT)
        expect(fakeCanvas.width).toBe(400)
    })

    test("propage une erreur si le contexte 2D est indisponible, et ferme quand même le bitmap", async () => {
        const file = new File(["x"], "big.png", { type: "image/png" })
        const bitmap = mockBitmap(800, 400)
        globalThis.createImageBitmap = rstest.fn().mockResolvedValue(bitmap)
        stubCanvas({ getContext: () => null })

        await expect(resizeImageToMaxHeight(file, 200)).rejects.toThrow()
        expect(bitmap.close).toHaveBeenCalledTimes(1)
    })

    test("propage une erreur si l'encodage canvas échoue (toBlob renvoie null)", async () => {
        const file = new File(["x"], "big.png", { type: "image/png" })
        const bitmap = mockBitmap(800, 400)
        globalThis.createImageBitmap = rstest.fn().mockResolvedValue(bitmap)
        stubCanvas({ toBlob: (cb) => cb(null) })

        await expect(resizeImageToMaxHeight(file, 200)).rejects.toThrow()
        expect(bitmap.close).toHaveBeenCalledTimes(1)
    })
})

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const JPEG = [0xff, 0xd8, 0xff, 0xe0]
const WEBP = [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]

function fileOf(bytes: number[], name: string, type: string) {
    return new File([new Uint8Array(bytes)], name, { type })
}

describe("sniffImageMime", () => {
    test("reconnaît les formats matriciels acceptés", async () => {
        expect(await sniffImageMime(fileOf(PNG, "a.png", "image/png"))).toBe("image/png")
        expect(await sniffImageMime(fileOf(JPEG, "a.jpg", "image/jpeg"))).toBe("image/jpeg")
        expect(await sniffImageMime(fileOf(WEBP, "a.webp", "image/webp"))).toBe("image/webp")
    })

    /**
     * Le cœur du garde-fou : nom et type MIME sont fournis par celui qui
     * téléverse, seuls les octets ne mentent pas.
     */
    test("rejette un SVG déguisé en PNG par son nom et son type", async () => {
        const svgBytes = Array.from('<svg xmlns="http://www.w3.org/2000/svg"/>').map((c) =>
            c.charCodeAt(0)
        )
        expect(await sniffImageMime(fileOf(svgBytes, "innocent.png", "image/png"))).toBe(null)
    })

    test("rejette un fichier vide ou d'un format non accepté", async () => {
        expect(await sniffImageMime(fileOf([], "vide.png", "image/png"))).toBe(null)
        expect(await sniffImageMime(fileOf([0x47, 0x49, 0x46, 0x38], "a.gif", "image/gif"))).toBe(null)
    })
})
