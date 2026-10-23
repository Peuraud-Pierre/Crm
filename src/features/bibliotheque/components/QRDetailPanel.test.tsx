// ── QRDetailPanel.test.tsx ────────────────────────────────────────────────────
// Tests unitaires de QRDetailPanel : deux branches de rendu (aucune sélection
// vs Q&R sélectionnée), le surlignage des termes recherchés (fonction highlight,
// déjà testée isolément dans utils.test.tsx — ici on vérifie juste qu'elle est
// bien appelée avec le texte affiché), la navigation vers la thématique parente,
// les actions Modifier/Supprimer/Formater, et leur masquage sans la permission
// bibliotheque.manage (même comportement que QRCard, voir QRCard.test.tsx).

import { describe, expect, test, rstest, beforeEach } from "@rstest/core"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { UI_TEXT } from "../constants"
import type { QR, Thematique, Lang } from "../types"

const mocks = rstest.hoisted(() => ({
    lang: "fr" as Lang,
    debouncedQuery: "",
    canManage: true,
    handleNavigate: rstest.fn(),
    openViewFormat: rstest.fn(),
    openEditQR: rstest.fn(),
    openDeleteQR: rstest.fn(),
    detailQR: undefined as QR | undefined,
    detailThematique: undefined as Thematique | undefined,
}))

function mockBiblioContextValue() {
    return {
        perms: { canManage: mocks.canManage },
        nav: {
            lang: mocks.lang, ui: UI_TEXT[mocks.lang as Lang], debouncedQuery: mocks.debouncedQuery,
            handleNavigate: mocks.handleNavigate, detailQR: mocks.detailQR, detailThematique: mocks.detailThematique,
        },
        dialogs: { openViewFormat: mocks.openViewFormat, openEditQR: mocks.openEditQR, openDeleteQR: mocks.openDeleteQR },
    }
}

rstest.mock("@/features/bibliotheque/context/BiblioContext", () => ({
    useBiblioContext: mockBiblioContextValue,
}))

import { QRDetailPanel } from "./QRDetailPanel"

const mkQR = (overrides: Partial<QR> = {}): QR => ({
    id: "qr1", thematiqueId: "t1", question: "Quel est le délai de livraison ?", questionEn: "",
    briefQr: "3 jours ouvrés", briefQrEn: "",
    ...overrides,
})

const mkThematique = (overrides: Partial<Thematique> = {}): Thematique => ({
    id: "t1", label: "Livraison", labelEn: "Delivery", imageUrl: "", iconUrl: "",
    ...overrides,
})

beforeEach(() => {
    rstest.clearAllMocks()
    mocks.lang = "fr"
    mocks.debouncedQuery = ""
    mocks.canManage = true
    mocks.detailQR = undefined
    mocks.detailThematique = undefined
})

describe("QRDetailPanel — aucune sélection", () => {
    test("affiche le message d'invite quand detailQR est absent", () => {
        // Le texte est réparti sur deux nœuds séparés par un <br/> — un match
        // exact sur le premier segment échouerait (textContent du <p> concatène
        // les deux lignes sans séparateur), d'où l'usage d'une regex substring.
        render(<QRDetailPanel />)
        expect(screen.getByText(new RegExp(UI_TEXT.fr.selectQuestionLine1))).toBeInTheDocument()
    })
})

describe("QRDetailPanel — Q&R sélectionnée", () => {
    test("affiche la question et la réponse, avec surlignage du terme cherché", () => {
        mocks.detailQR = mkQR()
        mocks.detailThematique = mkThematique()
        mocks.debouncedQuery = "délai"
        render(<QRDetailPanel />)
        // <mark> entoure le terme cherché — le texte reste retrouvable en tout
        const mark = screen.getByText("délai", { selector: "mark" })
        expect(mark).toBeInTheDocument()
    })

    test("affiche le nom de la thématique parente dans le fil d'Ariane", () => {
        mocks.detailQR = mkQR()
        mocks.detailThematique = mkThematique({ label: "Livraison" })
        render(<QRDetailPanel />)
        expect(screen.getByText("Livraison")).toBeInTheDocument()
    })

    test("clic sur 'Voir la thématique' appelle handleNavigate avec l'id de la thématique", async () => {
        const user = userEvent.setup()
        mocks.detailQR = mkQR()
        mocks.detailThematique = mkThematique({ id: "t1" })
        render(<QRDetailPanel />)
        await user.click(screen.getByRole("button", { name: new RegExp(UI_TEXT.fr.viewTopic, "i") }))
        expect(mocks.handleNavigate).toHaveBeenCalledWith("t1")
    })

    test("le clic sur Formater ouvre le pop-up (openViewFormat) avec l'objet QR", async () => {
        const user = userEvent.setup()
        const qr = mkQR()
        mocks.detailQR = qr
        mocks.detailThematique = mkThematique()
        render(<QRDetailPanel />)
        await user.click(screen.getByRole("button", { name: new RegExp(UI_TEXT.fr.format, "i") }))
        expect(mocks.openViewFormat).toHaveBeenCalledWith(qr)
    })

    test("le bouton Modifier appelle openEditQR avec l'objet QR", async () => {
        const user = userEvent.setup()
        const qr = mkQR()
        mocks.detailQR = qr
        mocks.detailThematique = mkThematique()
        render(<QRDetailPanel />)
        await user.click(screen.getByRole("button", { name: new RegExp(UI_TEXT.fr.edit, "i") }))
        expect(mocks.openEditQR).toHaveBeenCalledWith(qr)
    })

    test("le bouton Supprimer appelle openDeleteQR avec l'objet QR", async () => {
        const user = userEvent.setup()
        const qr = mkQR()
        mocks.detailQR = qr
        mocks.detailThematique = mkThematique()
        render(<QRDetailPanel />)
        await user.click(screen.getByRole("button", { name: new RegExp(UI_TEXT.fr.delete, "i") }))
        expect(mocks.openDeleteQR).toHaveBeenCalledWith(qr)
    })
})

describe("QRDetailPanel — permission bibliotheque.manage", () => {
    test("sans la permission, Modifier et Supprimer ne sont pas rendus", () => {
        mocks.canManage = false
        mocks.detailQR = mkQR()
        mocks.detailThematique = mkThematique()
        render(<QRDetailPanel />)
        expect(
            screen.queryByRole("button", { name: new RegExp(UI_TEXT.fr.edit, "i") })
        ).not.toBeInTheDocument()
        expect(
            screen.queryByRole("button", { name: new RegExp(UI_TEXT.fr.delete, "i") })
        ).not.toBeInTheDocument()
    })

    test("sans la permission, le bouton Formats reste disponible (consultation)", () => {
        mocks.canManage = false
        mocks.detailQR = mkQR()
        mocks.detailThematique = mkThematique()
        render(<QRDetailPanel />)
        expect(
            screen.getByRole("button", { name: new RegExp(UI_TEXT.fr.format, "i") })
        ).toBeInTheDocument()
    })
})
