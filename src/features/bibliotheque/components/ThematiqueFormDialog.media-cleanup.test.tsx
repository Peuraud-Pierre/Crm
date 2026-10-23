// ── ThematiqueFormDialog.media-cleanup.test.tsx ───────────────────────────────
// Tests unitaires de ThematiqueFormDialog — NETTOYAGE STORAGE (fichiers orphelins).
//
// Fait partie d'un groupe de 4 fichiers (voir ThematiqueFormDialog.test.tsx pour
// la liste complète et l'explication du découpage / de la duplication du mock).
//
// Contexte du bug corrigé (voir ThematiqueFormDialog.tsx, uploadedImagePathsRef/
// uploadedIconPathsRef, cleanupAbandonedUploads) : chaque sélection de fichier
// déclenche un upload IMMÉDIAT vers Supabase Storage (avant la sauvegarde). Si
// l'utilisateur choisit un fichier, puis en choisit un AUTRE avant de valider,
// les deux uploads ont réellement eu lieu — mais seul le second finit référencé
// (dans le formulaire, puis en base si sauvegardé). Sans nettoyage explicite, le
// premier reste orphelin dans le bucket pour toujours, y compris en cas de
// sauvegarde RÉUSSIE (pas seulement à l'annulation).
//
// Comportements testés ICI :
//   1. Annuler après un seul upload supprime ce fichier (cas simple, régression)
//   2. Annuler sans rien changer n'appelle pas le nettoyage (rien à supprimer)
//   3. Changer deux fois d'image avant d'annuler supprime LES DEUX fichiers
//   4. Une sauvegarde réussie nettoie l'upload intermédiaire abandonné, mais
//      conserve la valeur finale (celle désormais référencée en base)

import { describe, expect, test, rstest, beforeEach } from "@rstest/core"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { UI_TEXT } from "../constants"

const mocks = rstest.hoisted(() => {
    return {
        closeDialog: rstest.fn(),
        handleSaveThematique: rstest.fn(),
        uploadThematiqueImage: rstest.fn(),
        uploadThematiqueIcon: rstest.fn(),
        discardUnsavedThematiqueMedia: rstest.fn(),
        resolveThematiqueMediaUrl: rstest.fn(),
        resizeImageToMaxHeight: rstest.fn(),
        sniffImageMime: rstest.fn(),
        dialogRef: { current: null as null | { mode: string; thematique?: object } },
    }
})

rstest.mock("@/features/bibliotheque/imageResize", () => ({
    resizeImageToMaxHeight: mocks.resizeImageToMaxHeight,
    // Le champ image lit désormais les octets du fichier avant tout upload ;
    // le vrai sniff est testé dans imageResize.test.ts.
    sniffImageMime: mocks.sniffImageMime,
    THEMATIQUE_IMAGE_MAX_HEIGHT: 200,
}))

function mockBiblioContextValue() {
    return {
        nav: { ui: UI_TEXT.fr },
        dialogs: {
            dialog: mocks.dialogRef.current,
            closeDialog: mocks.closeDialog,
        },
        handlers: {
            handleSaveThematique: mocks.handleSaveThematique,
            uploadThematiqueImage: mocks.uploadThematiqueImage,
            uploadThematiqueIcon: mocks.uploadThematiqueIcon,
            discardUnsavedThematiqueMedia: mocks.discardUnsavedThematiqueMedia,
            resolveThematiqueMediaUrl: mocks.resolveThematiqueMediaUrl,
        },
    }
}

rstest.mock("@/features/bibliotheque/context/BiblioContext", () => ({
    useBiblioContext: mockBiblioContextValue,
}))

import { ThematiqueFormDialog } from "./ThematiqueFormDialog"

beforeEach(() => {
    rstest.clearAllMocks()
    mocks.dialogRef.current = { mode: "create-thematique" }
    mocks.handleSaveThematique.mockResolvedValue(undefined)
    mocks.uploadThematiqueImage.mockResolvedValue("livraison.png")
    mocks.uploadThematiqueIcon.mockResolvedValue("icons/livraison.svg")
    mocks.discardUnsavedThematiqueMedia.mockResolvedValue(undefined)
    mocks.resolveThematiqueMediaUrl.mockImplementation((v: string) => v ? `resolved:${v}` : "")
    mocks.resizeImageToMaxHeight.mockImplementation((file: File) => Promise.resolve(file))
    mocks.sniffImageMime.mockResolvedValue("image/png")
})

function makeFile(name: string, type: string, sizeBytes = 1024): File {
    const file = new File(["contenu"], name, { type })
    Object.defineProperty(file, "size", { value: sizeBytes })
    return file
}

async function fillRequiredName(user: ReturnType<typeof userEvent.setup>) {
    await user.type(
        screen.getByLabelText(new RegExp(UI_TEXT.fr.topicNameLabel, "i")),
        "Livraison"
    )
}

describe("ThematiqueFormDialog — annulation après upload", () => {
    test("annuler après avoir choisi une image supprime le fichier non sauvegardé", async () => {
        const user = userEvent.setup()
        render(<ThematiqueFormDialog />)
        await fillRequiredName(user)

        const file = makeFile("photo.png", "image/png")
        await user.upload(screen.getByLabelText(UI_TEXT.fr.topicImageLabel), file)
        await waitFor(() => expect(mocks.uploadThematiqueImage).toHaveBeenCalledTimes(1))

        await user.click(screen.getByRole("button", { name: UI_TEXT.fr.cancel }))

        await waitFor(() =>
            expect(mocks.discardUnsavedThematiqueMedia).toHaveBeenCalledWith("livraison.png", "")
        )
    })

    test("annuler sans avoir rien changé n'appelle pas le nettoyage", async () => {
        mocks.dialogRef.current = {
            mode: "rename-thematique",
            thematique: { id: "t1", label: "Livraison", labelEn: "Delivery", imageUrl: "livraison.png", iconUrl: "" },
        }
        const user = userEvent.setup()
        render(<ThematiqueFormDialog />)
        await waitFor(() =>
            expect(screen.getByLabelText(new RegExp(UI_TEXT.fr.topicNameLabel, "i"))).toHaveValue("Livraison")
        )

        await user.click(screen.getByRole("button", { name: UI_TEXT.fr.cancel }))

        expect(mocks.discardUnsavedThematiqueMedia).not.toHaveBeenCalled()
    })
})

describe("ThematiqueFormDialog — fermeture bloquée pendant un upload en cours", () => {
    // Bug corrigé : onOpenChange/le bouton Annuler ne vérifiaient que isSaving,
    // pas le busy global (isSaving || isUploadingImage || isUploadingIcon). Fermer
    // pendant qu'un upload est en vol nettoyait un historique qui ne contenait pas
    // encore ce chemin (poussé seulement quand l'upload se termine) — le fichier
    // devenait alors orphelin en Storage dès qu'il finissait, après le nettoyage.
    test("le bouton Annuler est désactivé tant qu'un upload est en cours, et le nettoyage n'est pas manqué une fois l'upload terminé", async () => {
        let resolveUpload!: (path: string) => void
        const uploadInProgress = new Promise<string>((resolve) => { resolveUpload = resolve })
        mocks.uploadThematiqueImage.mockReturnValueOnce(uploadInProgress)

        const user = userEvent.setup()
        render(<ThematiqueFormDialog />)
        await fillRequiredName(user)

        await user.upload(screen.getByLabelText(UI_TEXT.fr.topicImageLabel), makeFile("photo.png", "image/png"))

        await waitFor(() => {
            expect(screen.getByRole("button", { name: UI_TEXT.fr.cancel })).toBeDisabled()
        })

        resolveUpload("photo.png")

        await waitFor(() => {
            expect(screen.getByRole("button", { name: UI_TEXT.fr.cancel })).not.toBeDisabled()
        })
        await user.click(screen.getByRole("button", { name: UI_TEXT.fr.cancel }))

        // Le chemin est bien nettoyé — il n'a jamais pu devenir orphelin puisque
        // la fermeture était bloquée tant qu'il n'était pas encore historisé.
        await waitFor(() =>
            expect(mocks.discardUnsavedThematiqueMedia).toHaveBeenCalledWith("photo.png", "")
        )
    })
})

describe("ThematiqueFormDialog — uploads intermédiaires abandonnés (swap avant validation)", () => {
    test("changer deux fois d'image avant d'annuler supprime les deux fichiers uploadés", async () => {
        mocks.uploadThematiqueImage
            .mockResolvedValueOnce("photo1.png")
            .mockResolvedValueOnce("photo2.png")

        const user = userEvent.setup()
        render(<ThematiqueFormDialog />)
        await fillRequiredName(user)

        const imageInput = screen.getByLabelText(UI_TEXT.fr.topicImageLabel)
        await user.upload(imageInput, makeFile("a.png", "image/png"))
        await waitFor(() => expect(mocks.uploadThematiqueImage).toHaveBeenCalledTimes(1))

        // Deuxième sélection AVANT toute validation : remplace la valeur du
        // formulaire, mais le premier fichier reste réellement en Storage.
        await user.upload(imageInput, makeFile("b.png", "image/png"))
        await waitFor(() => expect(mocks.uploadThematiqueImage).toHaveBeenCalledTimes(2))

        await user.click(screen.getByRole("button", { name: UI_TEXT.fr.cancel }))

        // Les DEUX chemins uploadés cette session doivent être supprimés — aucun
        // n'a été sauvegardé. cleanupAbandonedUploads les envoie par paires
        // (image, icône) : un appel par chemin abandonné ici (icône toujours "").
        await waitFor(() => expect(mocks.discardUnsavedThematiqueMedia).toHaveBeenCalledTimes(2))
        const calledPaths = mocks.discardUnsavedThematiqueMedia.mock.calls.map((args: unknown[]) => args[0])
        expect(calledPaths).toContain("photo1.png")
        expect(calledPaths).toContain("photo2.png")
    })

    test("une sauvegarde réussie nettoie l'upload intermédiaire abandonné mais garde la valeur finale", async () => {
        mocks.uploadThematiqueImage
            .mockResolvedValueOnce("photo1.png")
            .mockResolvedValueOnce("photo2.png")

        const user = userEvent.setup()
        render(<ThematiqueFormDialog />)
        await fillRequiredName(user)
        await user.type(
            screen.getByLabelText(new RegExp(UI_TEXT.en.topicNameLabel, "i")),
            "Delivery"
        )

        const imageInput = screen.getByLabelText(UI_TEXT.fr.topicImageLabel)
        await user.upload(imageInput, makeFile("a.png", "image/png"))
        await waitFor(() => expect(mocks.uploadThematiqueImage).toHaveBeenCalledTimes(1))
        // Remplace par un second fichier avant de valider — le premier devient abandonné
        await user.upload(imageInput, makeFile("b.png", "image/png"))
        await waitFor(() => expect(mocks.uploadThematiqueImage).toHaveBeenCalledTimes(2))

        await user.click(screen.getByRole("button", { name: UI_TEXT.fr.create }))
        await waitFor(() => expect(mocks.handleSaveThematique).toHaveBeenCalledTimes(1))

        // Seul le premier chemin (abandonné) doit être supprimé — le second
        // (photo2.png, transmis à handleSaveThematique) doit être conservé car
        // c'est désormais la valeur persistée en base.
        await waitFor(() =>
            expect(mocks.discardUnsavedThematiqueMedia).toHaveBeenCalledWith("photo1.png", "")
        )
        expect(mocks.discardUnsavedThematiqueMedia).not.toHaveBeenCalledWith("photo2.png", "")
    })
})
