// ── ThematiqueFormDialog.upload.test.tsx ──────────────────────────────────────
// Tests unitaires de ThematiqueFormDialog — UPLOAD D'IMAGE / ICÔNE.
//
// Fait partie d'un groupe de 4 fichiers (voir ThematiqueFormDialog.test.tsx pour
// la liste complète et l'explication du découpage / de la duplication du mock).
//
// Le champ "Image"/"Icône" est un <input type="file"> masqué, associé à son
// <label> via htmlFor — screen.getByLabelText() le retrouve directement sans
// passer par le bouton visible (userEvent.upload() n'a pas besoin que l'input
// soit visible pour fonctionner).
//
// Comportements testés ICI :
//   Upload d'image/icône : succès, taille excessive, SVG dangereux, type invalide, échec réseau
//   Redimensionnement de l'image (voir ../imageResize.ts, mocké ici — cette
//   suite vérifie seulement que ThematiqueFormDialog l'appelle et envoie son
//   résultat à l'upload, pas le calcul de redimensionnement lui-même, qui
//   dépend d'API canvas absentes de jsdom et est testé dans imageResize.test.ts)
//   Remplacement d'image à la SOUMISSION en mode renommage (replaceThematiqueImage,
//   voir bibliothequeMediaService.ts) : l'ancienne image doit être supprimée du
//   bucket avant que la nouvelle ne soit enregistrée sous le nom de la thématique.

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
        replaceThematiqueImage: rstest.fn(),
        resolveThematiqueMediaUrl: rstest.fn(),
        resizeImageToMaxHeight: rstest.fn(),
        sniffImageMime: rstest.fn(),
        dialogRef: { current: null as null | { mode: string; thematique?: object } },
    }
})

rstest.mock("@/features/bibliotheque/imageResize", () => ({
    resizeImageToMaxHeight: mocks.resizeImageToMaxHeight,
    // Le vrai sniff lit les octets du fichier ; il est testé dans
    // imageResize.test.ts. Ici on veut seulement que le champ image le
    // consulte — le cas du refus a son propre test plus bas.
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
            replaceThematiqueImage: mocks.replaceThematiqueImage,
            resolveThematiqueMediaUrl: mocks.resolveThematiqueMediaUrl,
        },
    }
}

rstest.mock("@/features/bibliotheque/context/BiblioContext", () => ({
    useBiblioContext: mockBiblioContextValue,
}))

import { ThematiqueFormDialog } from "./ThematiqueFormDialog"
import { silenceExpectedLogs } from "@/shared/lib/testing"

// Ces tests provoquent volontairement des erreurs pour vérifier leur gestion :
// le log applicatif qui en résulte est attendu, pas un symptôme.
silenceExpectedLogs("[ThematiqueFormDialog]")

beforeEach(() => {
    rstest.clearAllMocks()
    mocks.dialogRef.current = { mode: "create-thematique" }
    mocks.handleSaveThematique.mockResolvedValue(undefined)
    mocks.uploadThematiqueImage.mockResolvedValue("livraison.png")
    mocks.uploadThematiqueIcon.mockResolvedValue("icons/livraison.svg")
    mocks.discardUnsavedThematiqueMedia.mockResolvedValue(undefined)
    // Par défaut, "remplace" en renvoyant le chemin déjà uploadé tel quel —
    // les tests dédiés au remplacement surchargent cette résolution.
    mocks.replaceThematiqueImage.mockImplementation((_old: string, newPath: string) => Promise.resolve(newPath))
    mocks.resolveThematiqueMediaUrl.mockImplementation((v: string) => v ? `resolved:${v}` : "")
    // Par défaut, le redimensionnement est une passe identité (retourne le
    // même fichier) — les tests qui veulent vérifier qu'un fichier DIFFÉRENT
    // est bien envoyé à l'upload surchargent ce mock explicitement.
    mocks.resizeImageToMaxHeight.mockImplementation((file: File) => Promise.resolve(file))
    // Par défaut le fichier est accepté ; les tests qui vérifient le refus
    // réécrivent cette valeur.
    mocks.sniffImageMime.mockResolvedValue("image/png")
})

// Un fichier valide, réutilisé par plusieurs tests. `Object.defineProperty`
// pour forcer `.size` : la propriété est normalement dérivée du contenu réel,
// mais construire un vrai fichier de plusieurs Mo en mémoire serait inutile —
// on simule juste la taille rapportée par le navigateur.
//
// Le contenu est une vraie signature PNG : le champ image lit désormais les
// premiers octets du fichier (sniffImageMime) plutôt que de croire son nom ou
// son type, donc un contenu texte factice serait rejeté avant l'upload.
const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function makeFile(name: string, type: string, sizeBytes = 1024): File {
    const file = new File([PNG_SIGNATURE], name, { type })
    Object.defineProperty(file, "size", { value: sizeBytes })
    return file
}

async function fillRequiredName(user: ReturnType<typeof userEvent.setup>) {
    await user.type(
        screen.getByLabelText(new RegExp(UI_TEXT.fr.topicNameLabel, "i")),
        "Livraison"
    )
}

describe("ThematiqueFormDialog — upload de médias", () => {
    test("sélectionner une image valide déclenche l'upload et affiche l'aperçu résolu", async () => {
        const user = userEvent.setup()
        render(<ThematiqueFormDialog />)
        await fillRequiredName(user)

        const file = makeFile("photo.png", "image/png")
        await user.upload(screen.getByLabelText(UI_TEXT.fr.topicImageLabel), file)

        await waitFor(() => expect(mocks.uploadThematiqueImage).toHaveBeenCalledTimes(1))
        // 3 arguments : le fichier, le nom trimé, excludeId (undefined en création)
        expect(mocks.uploadThematiqueImage).toHaveBeenCalledWith(file, "Livraison", undefined)

        await waitFor(() => {
            const img = document.querySelector("img[alt='']")
            expect(img).toHaveAttribute("src", "resolved:livraison.png")
        })
    })

    test("le fichier image sélectionné passe par resizeImageToMaxHeight avant l'upload", async () => {
        const user = userEvent.setup()
        render(<ThematiqueFormDialog />)
        await fillRequiredName(user)

        const file = makeFile("photo.png", "image/png")
        await user.upload(screen.getByLabelText(UI_TEXT.fr.topicImageLabel), file)

        await waitFor(() => expect(mocks.resizeImageToMaxHeight).toHaveBeenCalledTimes(1))
        expect(mocks.resizeImageToMaxHeight).toHaveBeenCalledWith(file)
    })

    test("c'est le fichier redimensionné (pas l'original) qui est envoyé à uploadThematiqueImage", async () => {
        const user = userEvent.setup()
        const resized = makeFile("photo.png", "image/png")
        mocks.resizeImageToMaxHeight.mockResolvedValue(resized)
        render(<ThematiqueFormDialog />)
        await fillRequiredName(user)

        const original = makeFile("photo.png", "image/png")
        await user.upload(screen.getByLabelText(UI_TEXT.fr.topicImageLabel), original)

        await waitFor(() => expect(mocks.uploadThematiqueImage).toHaveBeenCalledTimes(1))
        // File n'a pas de propriétés propres énumérables (contenu binaire compris) :
        // une égalité structurelle (toHaveBeenCalledWith) ne peut pas distinguer
        // deux File du même nom/type. On vérifie donc l'IDENTITÉ de l'objet reçu
        // (===) plutôt qu'une égalité de valeur.
        const receivedFile = mocks.uploadThematiqueImage.mock.calls[0][0]
        expect(receivedFile).toBe(resized)
        expect(receivedFile).not.toBe(original)
    })

    test("l'icône SVG n'est jamais passée à resizeImageToMaxHeight (seule l'image l'est)", async () => {
        const user = userEvent.setup()
        render(<ThematiqueFormDialog />)
        await fillRequiredName(user)

        const svg = new File(
            ['<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>'],
            "icon.svg",
            { type: "image/svg+xml" }
        )
        await user.upload(screen.getByLabelText(UI_TEXT.fr.topicIconLabel), svg)

        await waitFor(() => expect(mocks.uploadThematiqueIcon).toHaveBeenCalledTimes(1))
        expect(mocks.resizeImageToMaxHeight).not.toHaveBeenCalled()
    })

    test("un échec de redimensionnement empêche l'upload et affiche l'erreur générique d'upload", async () => {
        const user = userEvent.setup()
        mocks.resizeImageToMaxHeight.mockRejectedValueOnce(new Error("decode error"))
        render(<ThematiqueFormDialog />)
        await fillRequiredName(user)

        const file = makeFile("photo.png", "image/png")
        await user.upload(screen.getByLabelText(UI_TEXT.fr.topicImageLabel), file)

        await waitFor(() => expect(mocks.resizeImageToMaxHeight).toHaveBeenCalledTimes(1))
        expect(mocks.uploadThematiqueImage).not.toHaveBeenCalled()
        await waitFor(() => {
            expect(screen.queryByText(UI_TEXT.fr.uploading)).not.toBeInTheDocument()
        })
    })

    test("sélectionner une icône SVG valide déclenche l'upload avec excludeId en mode renommage", async () => {
        mocks.dialogRef.current = {
            mode: "rename-thematique",
            thematique: { id: "t1", label: "Livraison", labelEn: "Delivery", imageUrl: "", iconUrl: "" },
        }
        const user = userEvent.setup()
        render(<ThematiqueFormDialog />)
        await waitFor(() =>
            expect(screen.getByLabelText(new RegExp(UI_TEXT.fr.topicNameLabel, "i"))).toHaveValue("Livraison")
        )

        // Contenu SVG valide requis : hasUnsafeSvgContent() rejette le XML malformé
        // (makeFile() génère un contenu texte factice, pas du XML).
        const svg = new File(
            ['<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>'],
            "icon.svg",
            { type: "image/svg+xml" }
        )
        await user.upload(screen.getByLabelText(UI_TEXT.fr.topicIconLabel), svg)

        await waitFor(() => expect(mocks.uploadThematiqueIcon).toHaveBeenCalledTimes(1))
        expect(mocks.uploadThematiqueIcon).toHaveBeenCalledWith(svg, "Livraison", "t1")
    })

    test("refuse une image dépassant la taille maximale et n'appelle pas l'upload", async () => {
        const user = userEvent.setup()
        render(<ThematiqueFormDialog />)
        await fillRequiredName(user)

        const tooBig = makeFile("photo.png", "image/png", 9 * 1024 * 1024) // > 8 Mo
        await user.upload(screen.getByLabelText(UI_TEXT.fr.topicImageLabel), tooBig)

        expect(mocks.uploadThematiqueImage).not.toHaveBeenCalled()
    })

    test("refuse un fichier icône dont le type n'est pas SVG et n'appelle pas l'upload", async () => {
        const user = userEvent.setup()
        render(<ThematiqueFormDialog />)
        await fillRequiredName(user)

        const notSvg = makeFile("icon.png", "image/png")
        await user.upload(screen.getByLabelText(UI_TEXT.fr.topicIconLabel), notSvg)

        expect(mocks.uploadThematiqueIcon).not.toHaveBeenCalled()
    })

    test("refuse un SVG contenant un <script> et n'appelle pas l'upload", async () => {
        const user = userEvent.setup()
        render(<ThematiqueFormDialog />)
        await fillRequiredName(user)

        const malicious = new File(
            ['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'],
            "icon.svg",
            { type: "image/svg+xml" }
        )
        await user.upload(screen.getByLabelText(UI_TEXT.fr.topicIconLabel), malicious)

        await waitFor(() => expect(mocks.uploadThematiqueIcon).not.toHaveBeenCalled())
    })

    test("refuse un SVG contenant une balise <foreignObject> et n'appelle pas l'upload", async () => {
        // foreignObject permet d'embarquer du HTML (donc potentiellement du JS)
        // dans un SVG — c'est l'un des 6 vecteurs documentés par hasUnsafeSvgContent().
        const user = userEvent.setup()
        render(<ThematiqueFormDialog />)
        await fillRequiredName(user)

        const malicious = new File(
            ['<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><body xmlns="http://www.w3.org/1999/xhtml"><script>alert(1)</script></body></foreignObject></svg>'],
            "icon.svg",
            { type: "image/svg+xml" }
        )
        await user.upload(screen.getByLabelText(UI_TEXT.fr.topicIconLabel), malicious)

        await waitFor(() => expect(mocks.uploadThematiqueIcon).not.toHaveBeenCalled())
    })

    /**
     * Le champ image n'accepte que du matriciel. L'attribut accept ne protège
     * rien (il se contourne en changeant le filtre du sélecteur de fichiers) :
     * seule la lecture des octets décide.
     */
    test("refuse dans le champ image un fichier dont le contenu n'est pas une image matricielle", async () => {
        const user = userEvent.setup()
        mocks.sniffImageMime.mockResolvedValue(null)
        render(<ThematiqueFormDialog />)
        await fillRequiredName(user)

        const deguise = makeFile("innocent.png", "image/png")
        await user.upload(screen.getByLabelText(UI_TEXT.fr.topicImageLabel), deguise)

        await waitFor(() => expect(mocks.uploadThematiqueImage).not.toHaveBeenCalled())
        expect(mocks.resizeImageToMaxHeight).not.toHaveBeenCalled()
    })

    /**
     * Un gestionnaire d'événement n'invalide pas le dessin : le fichier est
     * nettoyé puis téléversé, et c'est bien la version nettoyée qui part —
     * rejeter l'icône entière punirait l'utilisateur pour un attribut qu'un
     * logiciel de dessin a pu ajouter seul.
     */
    test("téléverse un SVG débarrassé de son gestionnaire d'événement inline (onload)", async () => {
        const user = userEvent.setup()
        render(<ThematiqueFormDialog />)
        await fillRequiredName(user)

        const malicious = new File(
            ['<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><circle r="5"/></svg>'],
            "icon.svg",
            { type: "image/svg+xml" }
        )
        await user.upload(screen.getByLabelText(UI_TEXT.fr.topicIconLabel), malicious)

        await waitFor(() => expect(mocks.uploadThematiqueIcon).toHaveBeenCalled())

        const uploaded = mocks.uploadThematiqueIcon.mock.calls[0][0] as File
        expect(uploaded).not.toBe(malicious)
        const text = await uploaded.text()
        expect(text.toLowerCase()).not.toContain("onload")
        expect(text).not.toContain("alert")
        expect(text).toContain("<circle")
    })

    test("accepte un SVG sans contenu dangereux", async () => {
        const user = userEvent.setup()
        render(<ThematiqueFormDialog />)
        await fillRequiredName(user)

        const safe = new File(
            ['<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>'],
            "icon.svg",
            { type: "image/svg+xml" }
        )
        await user.upload(screen.getByLabelText(UI_TEXT.fr.topicIconLabel), safe)

        await waitFor(() => expect(mocks.uploadThematiqueIcon).toHaveBeenCalledTimes(1))
    })

    test("échec de l'upload d'image : le bouton redevient actif (isUploading repasse à false)", async () => {
        const user = userEvent.setup()
        mocks.uploadThematiqueImage.mockRejectedValueOnce(new Error("network error"))
        render(<ThematiqueFormDialog />)
        await fillRequiredName(user)

        const file = makeFile("photo.png", "image/png")
        await user.upload(screen.getByLabelText(UI_TEXT.fr.topicImageLabel), file)

        await waitFor(() => expect(mocks.uploadThematiqueImage).toHaveBeenCalledTimes(1))
        await waitFor(() => {
            expect(screen.queryByText(UI_TEXT.fr.uploading)).not.toBeInTheDocument()
        })
    })

    test("échec de l'upload d'icône : le bouton redevient actif (isUploading repasse à false)", async () => {
        // Symétrique du test image ci-dessus — la branche icône a son propre state
        // isUploadingIcon, jamais exercée par le test image.
        const user = userEvent.setup()
        mocks.uploadThematiqueIcon.mockRejectedValueOnce(new Error("network error"))
        render(<ThematiqueFormDialog />)
        await fillRequiredName(user)

        const svg = new File(
            ['<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>'],
            "icon.svg",
            { type: "image/svg+xml" }
        )
        await user.upload(screen.getByLabelText(UI_TEXT.fr.topicIconLabel), svg)

        await waitFor(() => expect(mocks.uploadThematiqueIcon).toHaveBeenCalledTimes(1))
        await waitFor(() => {
            expect(screen.queryByText(UI_TEXT.fr.uploading)).not.toBeInTheDocument()
        })
    })

    test("le bouton d'upload d'image est désactivé tant que le nom est vide", () => {
        // handleImageChange bail out silencieusement si !label.trim() — le seul
        // signal visible pour l'utilisateur est la désactivation du bouton, testée
        // ici directement plutôt que le bail-out interne (pas observable depuis les
        // tests de rendu sans déclencher un vrai upload).
        render(<ThematiqueFormDialog />)
        const chooseImageButton = screen.getByRole("button", { name: new RegExp(UI_TEXT.fr.topicImageChoose) })
        expect(chooseImageButton).toBeDisabled()
    })

    test("le bouton d'upload d'icône est désactivé tant que le nom est vide", () => {
        render(<ThematiqueFormDialog />)
        const chooseIconButton = screen.getByRole("button", { name: new RegExp(UI_TEXT.fr.topicIconChoose) })
        expect(chooseIconButton).toBeDisabled()
    })
})

describe("ThematiqueFormDialog — remplacement d'image à la soumission (mode renommage)", () => {
    function openRenameWithExistingImage() {
        mocks.dialogRef.current = {
            mode: "rename-thematique",
            thematique: { id: "t1", label: "Livraison", labelEn: "Delivery", imageUrl: "livraison.png", iconUrl: "" },
        }
    }

    test("choisir une nouvelle image puis valider appelle replaceThematiqueImage avec l'ancien et le nouveau chemin, AVANT handleSaveThematique", async () => {
        openRenameWithExistingImage()
        mocks.uploadThematiqueImage.mockResolvedValue("livraison-2.png") // collision avec l'ancien fichier encore présent
        const callOrder: string[] = []
        mocks.replaceThematiqueImage.mockImplementation(async () => {
            callOrder.push("replace")
            return "livraison.png" // renommé vers le nom canonique après suppression de l'ancien
        })
        mocks.handleSaveThematique.mockImplementation(async () => { callOrder.push("save") })
        const user = userEvent.setup()
        render(<ThematiqueFormDialog />)
        await waitFor(() =>
            expect(screen.getByLabelText(new RegExp(UI_TEXT.fr.topicNameLabel, "i"))).toHaveValue("Livraison")
        )

        await user.upload(screen.getByLabelText(UI_TEXT.fr.topicImageLabel), makeFile("nouvelle-photo.png", "image/png"))
        await waitFor(() => expect(mocks.uploadThematiqueImage).toHaveBeenCalledTimes(1))

        await user.click(screen.getByRole("button", { name: UI_TEXT.fr.rename }))

        await waitFor(() => expect(mocks.replaceThematiqueImage).toHaveBeenCalledTimes(1))
        expect(mocks.replaceThematiqueImage).toHaveBeenCalledWith("livraison.png", "livraison-2.png", "Livraison", "t1")

        await waitFor(() => expect(mocks.handleSaveThematique).toHaveBeenCalledTimes(1))
        // Le chemin final (renommé) est bien celui transmis à la sauvegarde, pas
        // le chemin temporaire renvoyé par l'upload.
        expect(mocks.handleSaveThematique).toHaveBeenCalledWith("Livraison", "Delivery", "livraison.png", "")
        // Ordre : replaceThematiqueImage doit avoir résolu avant que handleSaveThematique ne soit appelé.
        expect(callOrder).toEqual(["replace", "save"])
    })

    test("ne remplace pas l'image si elle n'a pas été modifiée (aucun nouveau fichier choisi)", async () => {
        openRenameWithExistingImage()
        const user = userEvent.setup()
        render(<ThematiqueFormDialog />)
        await waitFor(() =>
            expect(screen.getByLabelText(new RegExp(UI_TEXT.fr.topicNameLabel, "i"))).toHaveValue("Livraison")
        )

        await user.click(screen.getByRole("button", { name: UI_TEXT.fr.rename }))

        await waitFor(() => expect(mocks.handleSaveThematique).toHaveBeenCalledTimes(1))
        expect(mocks.replaceThematiqueImage).not.toHaveBeenCalled()
        expect(mocks.handleSaveThematique).toHaveBeenCalledWith("Livraison", "Delivery", "livraison.png", "")
    })

    test("ne remplace pas l'image en mode création (aucune image initiale à remplacer)", async () => {
        mocks.uploadThematiqueImage.mockResolvedValue("livraison.png")
        const user = userEvent.setup()
        render(<ThematiqueFormDialog />)
        await fillRequiredName(user)
        await user.type(screen.getByLabelText(new RegExp(UI_TEXT.en.topicNameLabel, "i")), "Delivery")

        await user.upload(screen.getByLabelText(UI_TEXT.fr.topicImageLabel), makeFile("photo.png", "image/png"))
        await waitFor(() => expect(mocks.uploadThematiqueImage).toHaveBeenCalledTimes(1))

        await user.click(screen.getByRole("button", { name: UI_TEXT.fr.create }))

        await waitFor(() => expect(mocks.handleSaveThematique).toHaveBeenCalledTimes(1))
        expect(mocks.replaceThematiqueImage).not.toHaveBeenCalled()
    })

    test("un échec de replaceThematiqueImage bloque la sauvegarde (handleSaveThematique n'est pas appelé)", async () => {
        openRenameWithExistingImage()
        mocks.uploadThematiqueImage.mockResolvedValue("livraison-2.png")
        mocks.replaceThematiqueImage.mockRejectedValueOnce(new Error("storage error"))
        const user = userEvent.setup()
        render(<ThematiqueFormDialog />)
        await waitFor(() =>
            expect(screen.getByLabelText(new RegExp(UI_TEXT.fr.topicNameLabel, "i"))).toHaveValue("Livraison")
        )

        await user.upload(screen.getByLabelText(UI_TEXT.fr.topicImageLabel), makeFile("nouvelle-photo.png", "image/png"))
        await waitFor(() => expect(mocks.uploadThematiqueImage).toHaveBeenCalledTimes(1))

        await user.click(screen.getByRole("button", { name: UI_TEXT.fr.rename }))

        await waitFor(() => expect(mocks.replaceThematiqueImage).toHaveBeenCalledTimes(1))
        expect(mocks.handleSaveThematique).not.toHaveBeenCalled()
        // Le bouton redevient actif (isSaving repasse à false) malgré l'échec.
        await waitFor(() => {
            expect(screen.getByRole("button", { name: UI_TEXT.fr.rename })).not.toBeDisabled()
        })
    })
})
