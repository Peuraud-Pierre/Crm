// ── bibliothequeMediaService.test.ts ──────────────────────────────────────────
// Tests unitaires de la couche Storage (services/bibliothequeMediaService.ts),
// extraite de bibliothequeService.ts (qui dépassait 400 lignes — voir
// Architecture_Feature.pdf §15). Reprend intégralement les tests Storage qui
// vivaient jusqu'ici dans bibliothequeService.test.ts.
//
// Les tests du garde-fou d'atomicité en base (detectMediaConflict /
// relocateThematiqueMedia) vivent désormais dans bibliothequeMediaConflict.test.ts,
// aux côtés du code qu'ils testent (voir bibliothequeMediaConflict.ts).
//
// Stratégie de mock : identique à bibliothequeService.test.ts — `db` (via
// services/db.ts) et `supabase.storage` sont mockés en interceptant le module
// "@/integrations/supabase/client". `chainable(result)` simule le
// query-builder Supabase (thenable, chaînage de méthodes).

import { describe, expect, test, rstest, beforeEach } from "@rstest/core"

const mocks = rstest.hoisted(() => {
    const fromResults: unknown[] = []
    const from = rstest.fn(() => {
        const result = fromResults.shift() ?? { data: null, error: null }
        return chainable(result)
    })

    const storageUpload = rstest.fn()
    const storageMove = rstest.fn()
    const storageRemove = rstest.fn()
    const storageGetPublicUrl = rstest.fn()
    const storageFrom = rstest.fn(() => ({
        upload: storageUpload,
        move: storageMove,
        remove: storageRemove,
        getPublicUrl: storageGetPublicUrl,
    }))

    function chainable(result: unknown): PromiseLike<unknown> & Record<string, unknown> {
        const obj: Record<string, unknown> = {
            then: (resolve: (v: unknown) => unknown) => resolve(result),
        }
        const handler = () => obj
        for (const method of ["select", "eq", "neq", "in", "order", "limit", "single", "insert", "update", "delete", "upsert"]) {
            obj[method] = handler
        }
        return obj as PromiseLike<unknown> & Record<string, unknown>
    }

    return { from, fromResults, storageUpload, storageMove, storageRemove, storageGetPublicUrl, storageFrom, chainable }
})

rstest.mock("@/integrations/supabase/client", () => ({
    supabase: {
        from: mocks.from,
        storage: { from: mocks.storageFrom },
    },
}))

import * as media from "./bibliothequeMediaService"
import { silenceExpectedLogs } from "@/shared/lib/testing"

// Ces tests provoquent volontairement des erreurs pour vérifier leur gestion :
// le log applicatif qui en résulte est attendu, pas un symptôme.
silenceExpectedLogs("[bibliothequeMediaService]")

beforeEach(() => {
    rstest.clearAllMocks()
    mocks.fromResults.length = 0
})

// ── uploadThematiqueImage / uploadThematiqueIcon (slug + anti-collision) ──────

describe("uploadThematiqueImage", () => {
    test("dérive le chemin du label slugifié et de l'extension du fichier", async () => {
        mocks.fromResults.push({ data: [], error: null })
        mocks.storageUpload.mockResolvedValue({ data: {}, error: null })

        const file = new File(["x"], "photo.PNG", { type: "image/png" })
        const path = await media.uploadThematiqueImage(file, "Délais de livraison !")

        expect(path).toBe("delais-de-livraison.png")
        expect(mocks.storageUpload).toHaveBeenCalledWith(
            "delais-de-livraison.png", file, expect.objectContaining({ upsert: false })
        )
    })

    test("retombe sur 'jpg' si le nom de fichier n'a aucune extension (pas de point)", async () => {
        mocks.fromResults.push({ data: [], error: null })
        mocks.storageUpload.mockResolvedValue({ data: {}, error: null })

        const file = new File(["x"], "photo", { type: "image/png" })
        const path = await media.uploadThematiqueImage(file, "Livraison")

        expect(path).toBe("livraison.jpg")
    })

    test("ajoute un suffixe -2 si le slug est déjà pris par une AUTRE thématique", async () => {
        // Une seule requête batchée vérifie tout le lot de candidats d'un coup
        // (livraison.jpg, livraison-2.jpg, ...) : la réponse indique que seul
        // le premier est pris.
        mocks.fromResults.push({ data: [{ image_url: "livraison.jpg" }], error: null })
        mocks.storageUpload.mockResolvedValue({ data: {}, error: null })

        const file = new File(["x"], "photo.jpg", { type: "image/jpeg" })
        const path = await media.uploadThematiqueImage(file, "Livraison")

        expect(path).toBe("livraison-2.jpg")
        expect(mocks.from).toHaveBeenCalledTimes(1)
    })

    test("passe au lot suivant (nouvelle requête) si tous les candidats du premier lot sont pris", async () => {
        // 1er lot : livraison.jpg, livraison-2.jpg, ..., livraison-8.jpg — tous pris.
        // 2e lot : livraison-9.jpg, ... — livraison-9.jpg libre.
        const firstBatchTaken = ["livraison.jpg", ...Array.from({ length: 7 }, (_, i) => `livraison-${i + 2}.jpg`)]
        mocks.fromResults.push(
            { data: firstBatchTaken.map((image_url) => ({ image_url })), error: null },
            { data: [], error: null },
        )
        mocks.storageUpload.mockResolvedValue({ data: {}, error: null })

        const file = new File(["x"], "photo.jpg", { type: "image/jpeg" })
        const path = await media.uploadThematiqueImage(file, "Livraison")

        expect(path).toBe("livraison-9.jpg")
        expect(mocks.from).toHaveBeenCalledTimes(2)
    })

    test("nettoie une extension fabriquée pour empêcher une injection de chemin", async () => {
        mocks.fromResults.push({ data: [], error: null })
        mocks.storageUpload.mockResolvedValue({ data: {}, error: null })

        const file = new File(["x"], "a.png/../../icons/evil", { type: "image/png" })
        const path = await media.uploadThematiqueImage(file, "Livraison")

        expect(path).not.toContain("/../")
        expect(path).not.toContain("..")
        expect(path).not.toContain("/")
        expect(path).toBe("livraison.iconsevi")
    })

    test("retombe sur 'jpg' si l'extension est totalement vide après nettoyage", async () => {
        mocks.fromResults.push({ data: [], error: null })
        mocks.storageUpload.mockResolvedValue({ data: {}, error: null })

        const file = new File(["x"], "photo.!!!", { type: "image/png" })
        const path = await media.uploadThematiqueImage(file, "Livraison")

        expect(path).toBe("livraison.jpg")
    })

    test("propage l'erreur si l'upload Storage échoue", async () => {
        mocks.fromResults.push({ data: [], error: null })
        mocks.storageUpload.mockResolvedValue({ data: null, error: new Error("storage down") })

        const file = new File(["x"], "photo.png", { type: "image/png" })
        await expect(media.uploadThematiqueImage(file, "Livraison")).rejects.toThrow("storage down")
    })
})

// ── Collision Storage concurrente (upsert: false) ─────────────────────────────

describe("uploadThematiqueImage — collision Storage concurrente (upsert: false)", () => {
    test("retente avec le slug suivant si Storage refuse un chemin déjà pris par un upload concurrent", async () => {
        mocks.fromResults.push({ data: [], error: null })
        mocks.storageUpload
            .mockResolvedValueOnce({ data: null, error: { message: "The resource already exists", statusCode: "409" } })
            .mockResolvedValueOnce({ data: {}, error: null })

        const file = new File(["x"], "photo.png", { type: "image/png" })
        const path = await media.uploadThematiqueImage(file, "Livraison")

        expect(path).toBe("livraison-2.png")
        expect(mocks.storageUpload).toHaveBeenCalledTimes(2)
    })

    test("propage toute autre erreur Storage sans retenter (ce n'est pas un conflit de chemin)", async () => {
        mocks.fromResults.push({ data: [], error: null })
        mocks.storageUpload.mockResolvedValue({ data: null, error: new Error("network down") })

        const file = new File(["x"], "photo.png", { type: "image/png" })
        await expect(media.uploadThematiqueImage(file, "Livraison")).rejects.toThrow("network down")
        expect(mocks.storageUpload).toHaveBeenCalledTimes(1)
    })
})

describe("uploadThematiqueIcon", () => {
    test("préfixe toujours le chemin par icons/ et force l'extension .svg", async () => {
        mocks.fromResults.push({ data: [], error: null })
        mocks.storageUpload.mockResolvedValue({ data: {}, error: null })

        const file = new File(["<svg/>"], "mon-icone.svg", { type: "image/svg+xml" })
        const path = await media.uploadThematiqueIcon(file, "Livraison")

        expect(path).toBe("icons/livraison.svg")
        expect(mocks.storageUpload).toHaveBeenCalledWith(
            "icons/livraison.svg", file, expect.objectContaining({ contentType: "image/svg+xml" })
        )
    })

    test("excludeId n'empêche pas la détection de collision avec une AUTRE thématique", async () => {
        mocks.fromResults.push({ data: [{ icon_url: "icons/livraison.svg" }], error: null })
        mocks.storageUpload.mockResolvedValue({ data: {}, error: null })

        const file = new File(["<svg/>"], "icon.svg", { type: "image/svg+xml" })
        const path = await media.uploadThematiqueIcon(file, "Livraison", "t-self")

        expect(path).toBe("icons/livraison-2.svg")
    })
})

// ── syncThematiqueMediaNaming (renommage Storage best-effort) ────────────────

describe("syncThematiqueMediaNaming", () => {
    test("ne fait rien si le chemin actuel correspond déjà au nom courant", async () => {
        const result = await media.syncThematiqueMediaNaming("t1", "Livraison", "livraison.png", "")
        expect(result.imageUrl).toBe("livraison.png")
        expect(mocks.storageMove).not.toHaveBeenCalled()
    })

    test("déplace le fichier vers le nouveau slug quand le nom a changé", async () => {
        mocks.fromResults.push({ data: [], error: null })
        mocks.storageMove.mockResolvedValue({ data: {}, error: null })

        const result = await media.syncThematiqueMediaNaming("t1", "Nouveau nom", "ancien-nom.png", "")
        expect(result.imageUrl).toBe("nouveau-nom.png")
        expect(mocks.storageMove).toHaveBeenCalledWith("ancien-nom.png", "nouveau-nom.png")
    })

    test("ignore les URLs absolues (ne tente pas de les déplacer)", async () => {
        const result = await media.syncThematiqueMediaNaming("t1", "Nouveau nom", "https://cdn.example.com/x.png", "")
        expect(result.imageUrl).toBe("https://cdn.example.com/x.png")
        expect(mocks.storageMove).not.toHaveBeenCalled()
    })

    test("best-effort : si le déplacement Storage échoue, conserve l'ancien chemin sans lever d'erreur", async () => {
        mocks.fromResults.push({ data: [], error: null })
        mocks.storageMove.mockResolvedValue({ data: null, error: new Error("move failed") })

        const result = await media.syncThematiqueMediaNaming("t1", "Nouveau nom", "ancien-nom.png", "")
        expect(result.imageUrl).toBe("ancien-nom.png")
    })
})

// ── deleteThematiqueMedia ──────────────────────────────────────────────────────

describe("deleteThematiqueMedia", () => {
    test("ne fait aucun appel Storage si les deux chemins sont vides", async () => {
        await media.deleteThematiqueMedia("", "")
        expect(mocks.storageRemove).not.toHaveBeenCalled()
    })

    test("supprime uniquement les chemins non vides", async () => {
        mocks.storageRemove.mockResolvedValue({ data: [], error: null })
        await media.deleteThematiqueMedia("image.png", "")
        expect(mocks.storageRemove).toHaveBeenCalledWith(["image.png"])
    })

    test("propage l'erreur Storage", async () => {
        mocks.storageRemove.mockResolvedValue({ data: null, error: new Error("remove failed") })
        await expect(media.deleteThematiqueMedia("image.png", "icon.svg")).rejects.toThrow("remove failed")
    })
})

// ── replaceThematiqueImage (suppression de l'ancienne PUIS renommage de la nouvelle) ──

describe("replaceThematiqueImage", () => {
    test("supprime l'ancienne image AVANT de renommer la nouvelle vers le nom canonique de la thématique", async () => {
        const callOrder: string[] = []
        mocks.storageRemove.mockImplementation(async () => { callOrder.push("remove"); return { data: [], error: null } })
        mocks.storageMove.mockImplementation(async () => { callOrder.push("move"); return { data: {}, error: null } })
        mocks.fromResults.push({ data: [], error: null }) // findTakenPaths (pré-check batché dans renameMediaIfStale)

        const result = await media.replaceThematiqueImage("livraison.png", "livraison-2.png", "Livraison", "t1")

        expect(result).toBe("livraison.png")
        expect(mocks.storageRemove).toHaveBeenCalledWith(["livraison.png"])
        expect(mocks.storageMove).toHaveBeenCalledWith("livraison-2.png", "livraison.png")
        expect(callOrder).toEqual(["remove", "move"])
    })

    test("ne supprime rien si l'ancien chemin est vide (aucune image précédente)", async () => {
        await media.replaceThematiqueImage("", "livraison.png", "Livraison", "t1")
        expect(mocks.storageRemove).not.toHaveBeenCalled()
    })

    test("ne supprime rien si l'ancien et le nouveau chemin sont identiques (rien à remplacer)", async () => {
        const result = await media.replaceThematiqueImage("livraison.png", "livraison.png", "Livraison", "t1")
        expect(mocks.storageRemove).not.toHaveBeenCalled()
        expect(mocks.storageMove).not.toHaveBeenCalled()
        expect(result).toBe("livraison.png")
    })

    test("propage l'erreur si la suppression de l'ancienne image échoue, sans tenter de renommer la nouvelle", async () => {
        mocks.storageRemove.mockResolvedValue({ data: null, error: new Error("remove failed") })
        await expect(
            media.replaceThematiqueImage("livraison.png", "livraison-2.png", "Livraison", "t1")
        ).rejects.toThrow("remove failed")
        expect(mocks.storageMove).not.toHaveBeenCalled()
    })

    test("si le renommage échoue après suppression, conserve le chemin temporaire (best-effort, comme syncThematiqueMediaNaming)", async () => {
        mocks.storageRemove.mockResolvedValue({ data: [], error: null })
        mocks.fromResults.push({ data: [], error: null })
        mocks.storageMove.mockResolvedValue({ data: null, error: new Error("move failed") })

        const result = await media.replaceThematiqueImage("livraison.png", "livraison-2.png", "Livraison", "t1")
        expect(result).toBe("livraison-2.png")
    })
})

// ── resolveThematiqueMediaUrl ──────────────────────────────────────────────────

describe("resolveThematiqueMediaUrl", () => {
    test("retourne '' pour une valeur vide ou absente — pas d'appel Storage", () => {
        expect(media.resolveThematiqueMediaUrl("")).toBe("")
        expect(media.resolveThematiqueMediaUrl(null)).toBe("")
        expect(media.resolveThematiqueMediaUrl(undefined)).toBe("")
        expect(mocks.storageGetPublicUrl).not.toHaveBeenCalled()
    })

    test("résout un chemin en URL publique via Supabase Storage", () => {
        mocks.storageGetPublicUrl.mockReturnValue({ data: { publicUrl: "https://cdn.example.com/livraison.png" } })
        expect(media.resolveThematiqueMediaUrl("livraison.png")).toBe("https://cdn.example.com/livraison.png")
    })

    test("retourne la valeur telle quelle si c'est déjà une URL absolue ou un chemin statique (thématiques pré-migration Storage)", () => {
        expect(media.resolveThematiqueMediaUrl("https://cdn.example.com/x.png")).toBe("https://cdn.example.com/x.png")
        expect(media.resolveThematiqueMediaUrl("http://cdn.example.com/x.png")).toBe("http://cdn.example.com/x.png")
        expect(media.resolveThematiqueMediaUrl("/bibliotheque/mon-image.jpg")).toBe("/bibliotheque/mon-image.jpg")
        expect(mocks.storageGetPublicUrl).not.toHaveBeenCalled()
    })
})

// ── revertMediaMove (rollback si patchThematique échoue après un renommage) ──

describe("revertMediaMove", () => {
    test("ne fait rien si l'un des deux chemins est vide ou s'ils sont identiques", async () => {
        await media.revertMediaMove("", "ancien.png")
        await media.revertMediaMove("nouveau.png", "")
        await media.revertMediaMove("meme.png", "meme.png")
        expect(mocks.storageMove).not.toHaveBeenCalled()
    })

    test("ne tente rien si l'ancien chemin est une URL absolue (rien à restaurer côté bucket)", async () => {
        await media.revertMediaMove("nouveau.png", "https://cdn.example.com/x.png")
        expect(mocks.storageMove).not.toHaveBeenCalled()
    })

    test("déplace le fichier du nouveau chemin vers l'ancien", async () => {
        mocks.storageMove.mockResolvedValue({ data: {}, error: null })
        await media.revertMediaMove("nouveau.png", "ancien.png")
        expect(mocks.storageMove).toHaveBeenCalledWith("nouveau.png", "ancien.png")
    })

    test("n'échoue pas (best-effort) si le déplacement Storage échoue à son tour", async () => {
        mocks.storageMove.mockResolvedValue({ data: null, error: new Error("move failed") })
        await expect(media.revertMediaMove("nouveau.png", "ancien.png")).resolves.toBeUndefined()
    })
})

