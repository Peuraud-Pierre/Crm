// ── mediaUpload.test.ts ────────────────────────────────────────────────────────
// Tests unitaires de runMediaUpload — extrait de ThematiqueFormDialog.tsx (voir
// son en-tête). Le comportement de bout en bout (avec le vrai composant, les
// vrais champs) reste couvert par ThematiqueFormDialog.upload.test.tsx ; ici on
// teste la fonction isolément, y compris des combinaisons pas nécessairement
// toutes exercées via l'UI (ex: transformFile qui échoue mais validateContent
// qui passe).

import { describe, expect, test, rstest, beforeEach } from "@rstest/core"
import { runMediaUpload } from "./mediaUpload"
import { silenceExpectedLogs } from "@/shared/lib/testing"

// Ces tests provoquent volontairement des erreurs pour vérifier leur gestion :
// le log applicatif qui en résulte est attendu, pas un symptôme.
silenceExpectedLogs("[ThematiqueFormDialog]")

function makeFile(name = "photo.png", type = "image/png", size = 1024): File {
    const file = new File(["x"], name, { type })
    Object.defineProperty(file, "size", { value: size })
    return file
}

const toastError = rstest.hoisted(() => rstest.fn())
rstest.mock("sonner", () => ({ toast: { error: toastError } }))

beforeEach(() => {
    rstest.clearAllMocks()
})

describe("runMediaUpload", () => {
    test("refuse un fichier trop lourd sans appeler upload", async () => {
        const upload = rstest.fn()
        await runMediaUpload({
            file: makeFile("x", "image/png", 10_000_000),
            label: "Livraison", excludeId: undefined, maxSizeBytes: 1000,
            upload, setUploading: rstest.fn(), setValue: rstest.fn(),
            errTooLarge: (maxMb) => `Trop lourd (max ${maxMb} Mo)`, errUpload: "Erreur",
        })
        expect(upload).not.toHaveBeenCalled()
        expect(toastError).toHaveBeenCalledWith("Trop lourd (max 0.00095367431640625 Mo)")
    })

    test("refuse un contenu invalide (validateContent) sans appeler upload", async () => {
        const upload = rstest.fn()
        await runMediaUpload({
            file: makeFile(), label: "Livraison", excludeId: undefined, maxSizeBytes: 10_000_000,
            upload, setUploading: rstest.fn(), setValue: rstest.fn(),
            errTooLarge: () => "trop lourd", errUpload: "Erreur",
            validateContent: async () => "contenu dangereux",
        })
        expect(upload).not.toHaveBeenCalled()
        expect(toastError).toHaveBeenCalledWith("contenu dangereux")
    })

    test("accepte un contenu valide (validateContent renvoie null) et appelle upload", async () => {
        const upload = rstest.fn().mockResolvedValue("livraison.png")
        const setValue = rstest.fn()
        await runMediaUpload({
            file: makeFile(), label: "Livraison", excludeId: undefined, maxSizeBytes: 10_000_000,
            upload, setUploading: rstest.fn(), setValue,
            errTooLarge: () => "trop lourd", errUpload: "Erreur",
            validateContent: async () => null,
        })
        expect(upload).toHaveBeenCalledTimes(1)
        expect(setValue).toHaveBeenCalledWith("livraison.png")
    })

    test("applique transformFile avant l'upload, et c'est le résultat transformé qui est envoyé", async () => {
        const original = makeFile("original.png")
        const transformed = makeFile("transformed.png")
        const upload = rstest.fn().mockResolvedValue("livraison.png")
        await runMediaUpload({
            file: original, label: "Livraison", excludeId: undefined, maxSizeBytes: 10_000_000,
            upload, setUploading: rstest.fn(), setValue: rstest.fn(),
            errTooLarge: () => "trop lourd", errUpload: "Erreur",
            transformFile: async () => transformed,
        })
        expect(upload.mock.calls[0][0]).toBe(transformed)
    })

    test("passe true puis false à setUploading, même en cas de succès", async () => {
        const calls: boolean[] = []
        const setUploading = (v: boolean) => calls.push(v)
        await runMediaUpload({
            file: makeFile(), label: "Livraison", excludeId: undefined, maxSizeBytes: 10_000_000,
            upload: rstest.fn().mockResolvedValue("x.png"), setUploading, setValue: rstest.fn(),
            errTooLarge: () => "trop lourd", errUpload: "Erreur",
        })
        expect(calls).toEqual([true, false])
    })

    test("upload qui échoue : affiche errUpload, ne lève pas, et repasse setUploading à false", async () => {
        const calls: boolean[] = []
        const setUploading = (v: boolean) => calls.push(v)
        await expect(runMediaUpload({
            file: makeFile(), label: "Livraison", excludeId: undefined, maxSizeBytes: 10_000_000,
            upload: rstest.fn().mockRejectedValue(new Error("network")), setUploading, setValue: rstest.fn(),
            errTooLarge: () => "trop lourd", errUpload: "Échec de l'upload",
        })).resolves.toBeUndefined()
        expect(toastError).toHaveBeenCalledWith("Échec de l'upload")
        expect(calls).toEqual([true, false])
    })

    test("transformFile qui échoue : affiche errUpload et n'appelle jamais upload", async () => {
        const upload = rstest.fn()
        await runMediaUpload({
            file: makeFile(), label: "Livraison", excludeId: undefined, maxSizeBytes: 10_000_000,
            upload, setUploading: rstest.fn(), setValue: rstest.fn(),
            errTooLarge: () => "trop lourd", errUpload: "Échec du redimensionnement",
            transformFile: async () => { throw new Error("decode error") },
        })
        expect(upload).not.toHaveBeenCalled()
        expect(toastError).toHaveBeenCalledWith("Échec du redimensionnement")
    })

    test("transmet excludeId à upload", async () => {
        const upload = rstest.fn().mockResolvedValue("x.png")
        await runMediaUpload({
            file: makeFile(), label: "Livraison", excludeId: "t1", maxSizeBytes: 10_000_000,
            upload, setUploading: rstest.fn(), setValue: rstest.fn(),
            errTooLarge: () => "trop lourd", errUpload: "Erreur",
        })
        expect(upload).toHaveBeenCalledWith(expect.any(File), "Livraison", "t1")
    })
})
