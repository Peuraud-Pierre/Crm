// ── BiblioMainColumn.test.tsx ─────────────────────────────────────────────────
// Tests unitaires de BiblioMainColumn — jusqu'ici sans aucun test malgré un
// vrai branchement conditionnel (état vide vs liste de Q&R) et un déclenchement
// de dialog (openCreateQR) à deux endroits distincts (bouton d'en-tête et
// bouton de l'état vide).

import { describe, expect, test, rstest, beforeEach } from "@rstest/core"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { UI_TEXT } from "../constants"
import type { Thematique, QR } from "../types"

// jsdom n'implémente pas ResizeObserver — QRCard (rendu par BiblioMainColumn
// pour chaque Q&R) l'utilise pour détecter le débordement du texte de réponse.
class ResizeObserverStub {
    observe() {}
    disconnect() {}
}
;(globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver = ResizeObserverStub

const mocks = rstest.hoisted(() => ({
    canManage: true,
    activeThematique: undefined as Thematique | undefined,
    activeQRs: [] as QR[],
    openCreateQR: rstest.fn(),
    resolveThematiqueMediaUrl: rstest.fn((v: string | undefined) => v ?? ""),
    formatReponses: {} as Record<string, unknown>,
    openEditQR: rstest.fn(),
    openDeleteQR: rstest.fn(),
    openEditFormat: rstest.fn(),
    openViewFormat: rstest.fn(),
}))

function mockBiblioContextValue() {
    return {
        perms: { canManage: mocks.canManage },
        data: { activeThematique: mocks.activeThematique, activeQRs: mocks.activeQRs, formatReponses: mocks.formatReponses },
        nav: { lang: "fr" as const, ui: UI_TEXT.fr },
        dialogs: { openCreateQR: mocks.openCreateQR, openEditQR: mocks.openEditQR, openDeleteQR: mocks.openDeleteQR, openEditFormat: mocks.openEditFormat, openViewFormat: mocks.openViewFormat },
        handlers: { resolveThematiqueMediaUrl: mocks.resolveThematiqueMediaUrl },
    }
}

rstest.mock("@/features/bibliotheque/context/BiblioContext", () => ({
    useBiblioContext: mockBiblioContextValue,
}))

import { BiblioMainColumn } from "./BiblioMainColumn"

const mkThematique = (overrides: Partial<Thematique> = {}): Thematique => ({
    id: "t1", label: "Livraison", labelEn: "Delivery", imageUrl: "", iconUrl: "",
    ...overrides,
})

const mkQR = (overrides: Partial<QR> = {}): QR => ({
    id: "qr1", thematiqueId: "t1", question: "Quel est le délai ?", questionEn: "", briefQr: "3 jours", briefQrEn: "",
    ...overrides,
})

beforeEach(() => {
    rstest.clearAllMocks()
    mocks.canManage = true
    mocks.activeThematique = undefined
    mocks.activeQRs = []
    mocks.formatReponses = {}
})

describe("BiblioMainColumn — en-tête", () => {
    test("affiche le nom (FR) de la thématique active", () => {
        mocks.activeThematique = mkThematique({ label: "Livraison" })
        render(<BiblioMainColumn />)
        expect(screen.getByRole("heading", { name: "Livraison" })).toBeInTheDocument()
    })

    test("le bouton d'ajout d'en-tête appelle openCreateQR", async () => {
        const user = userEvent.setup()
        mocks.activeThematique = mkThematique()
        mocks.activeQRs = [mkQR()]
        render(<BiblioMainColumn />)
        await user.click(screen.getByRole("button", { name: UI_TEXT.fr.addQuestion }))
        expect(mocks.openCreateQR).toHaveBeenCalledTimes(1)
    })

    test("affiche le nombre de Q&R de la thématique active", () => {
        mocks.activeThematique = mkThematique()
        mocks.activeQRs = [mkQR({ id: "qr1" }), mkQR({ id: "qr2" })]
        render(<BiblioMainColumn />)
        expect(screen.getByText("2")).toBeInTheDocument()
    })
})

describe("BiblioMainColumn — état vide vs liste", () => {
    test("affiche l'état vide quand activeQRs est vide, avec un bouton d'ajout dédié", async () => {
        const user = userEvent.setup()
        mocks.activeThematique = mkThematique()
        mocks.activeQRs = []
        render(<BiblioMainColumn />)
        expect(screen.getByText(UI_TEXT.fr.noQuestions)).toBeInTheDocument()
        await user.click(screen.getByRole("button", { name: UI_TEXT.fr.addFirstQuestion }))
        expect(mocks.openCreateQR).toHaveBeenCalledTimes(1)
    })

    test("affiche une carte par Q&R quand activeQRs n'est pas vide", () => {
        mocks.activeThematique = mkThematique()
        mocks.activeQRs = [mkQR({ id: "qr1", question: "Quel est le délai ?" }), mkQR({ id: "qr2", question: "Comment retourner un article ?" })]
        render(<BiblioMainColumn />)
        expect(screen.getByText("Quel est le délai ?")).toBeInTheDocument()
        expect(screen.getByText("Comment retourner un article ?")).toBeInTheDocument()
        expect(screen.queryByText(UI_TEXT.fr.noQuestions)).not.toBeInTheDocument()
    })
})

describe("BiblioMainColumn — pagination (10 Q&R par page)", () => {
    const mkManyQRs = (count: number) =>
        Array.from({ length: count }, (_, i) => mkQR({ id: `qr${i + 1}`, question: `Question ${i + 1}` }))

    test("n'affiche aucun contrôle de pagination si 10 Q&R ou moins", () => {
        mocks.activeThematique = mkThematique()
        mocks.activeQRs = mkManyQRs(10)
        render(<BiblioMainColumn />)
        expect(screen.queryByText(UI_TEXT.fr.paginationPageOf(1, 1))).not.toBeInTheDocument()
        expect(screen.getByText("Question 10")).toBeInTheDocument()
    })

    test("n'affiche que les 10 premières Q&R sur la première page, avec l'indicateur de page", () => {
        mocks.activeThematique = mkThematique()
        mocks.activeQRs = mkManyQRs(15)
        render(<BiblioMainColumn />)
        expect(screen.getByText("Question 1")).toBeInTheDocument()
        expect(screen.getByText("Question 10")).toBeInTheDocument()
        expect(screen.queryByText("Question 11")).not.toBeInTheDocument()
        expect(screen.getByText(UI_TEXT.fr.paginationPageOf(1, 2))).toBeInTheDocument()
        expect(screen.getByRole("button", { name: UI_TEXT.fr.paginationPrevious })).toBeDisabled()
    })

    test("le bouton Suivant affiche la page suivante", async () => {
        const user = userEvent.setup()
        mocks.activeThematique = mkThematique()
        mocks.activeQRs = mkManyQRs(15)
        render(<BiblioMainColumn />)

        await user.click(screen.getByRole("button", { name: UI_TEXT.fr.paginationNext }))

        expect(screen.getByText("Question 11")).toBeInTheDocument()
        expect(screen.getByText("Question 15")).toBeInTheDocument()
        expect(screen.queryByText("Question 1")).not.toBeInTheDocument()
        expect(screen.getByText(UI_TEXT.fr.paginationPageOf(2, 2))).toBeInTheDocument()
        expect(screen.getByRole("button", { name: UI_TEXT.fr.paginationNext })).toBeDisabled()
    })

    test("le total affiché dans l'en-tête reste le total réel, pas la taille de la page", () => {
        mocks.activeThematique = mkThematique()
        mocks.activeQRs = mkManyQRs(15)
        render(<BiblioMainColumn />)
        expect(screen.getByText("15")).toBeInTheDocument()
    })
})
