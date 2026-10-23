// ── QRCard.test.tsx ───────────────────────────────────────────────────────────
// Tests unitaires de QRCard — jusqu'ici sans aucun test malgré une logique
// d'état non triviale : accordéon Formater, actions Modifier/Supprimer qui
// ouvrent les bons dialogs avec le bon objet QR, et réinitialisation de l'état
// "Voir plus/Voir moins" au changement de Q&R ou de langue. Le débordement de
// texte (ResizeObserver) n'est pas testé ici — jsdom ne layout pas réellement
// le texte, donc scrollHeight/clientHeight resteraient à 0 des deux côtés et
// ne prouveraient rien ; ce comportement dépend du rendu réel du navigateur.
//
// QRCard est un composant PUR (voir son en-tête) : tout est reçu en props, pas
// de mock de contexte nécessaire ici — juste des props directes, comme le fait
// BiblioMainColumn en conditions réelles.

import { describe, expect, test, rstest, beforeEach } from "@rstest/core"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { UI_TEXT } from "../constants"
import type { QR, Lang } from "../types"

// jsdom n'implémente pas ResizeObserver — QRCard l'utilise pour détecter le
// débordement du texte de réponse (voir son en-tête). Un stub minimal suffit :
// aucun test ici n'exerce le débordement lui-même.
class ResizeObserverStub {
    observe() {}
    disconnect() {}
}
;(globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver = ResizeObserverStub

import { QRCard } from "./QRCard"

const mkQR = (overrides: Partial<QR> = {}): QR => ({
    id: "qr1", thematiqueId: "t1", question: "Quel est le délai ?", questionEn: "What is the delay?",
    briefQr: "3 jours ouvrés", briefQrEn: "3 business days",
    ...overrides,
})

const mocks = {
    lang: "fr" as Lang,
    canManage: true,
    onEdit: rstest.fn(),
    onDelete: rstest.fn(),
    onViewFormat: rstest.fn(),
}

function renderQRCard(qr: QR) {
    return render(
        <QRCard
            qr={qr}
            canManage={mocks.canManage}
            lang={mocks.lang}
            ui={UI_TEXT[mocks.lang]}
            onEdit={mocks.onEdit}
            onDelete={mocks.onDelete}
            onViewFormat={mocks.onViewFormat}
        />
    )
}

beforeEach(() => {
    rstest.clearAllMocks()
    mocks.lang = "fr"
    mocks.canManage = true
})

describe("QRCard — rendu", () => {
    test("affiche la question et la réponse dans la langue active", () => {
        renderQRCard(mkQR())
        expect(screen.getByText("Quel est le délai ?")).toBeInTheDocument()
        expect(screen.getByText("3 jours ouvrés")).toBeInTheDocument()
    })
})

describe("QRCard — actions", () => {
    test("le bouton Modifier appelle onEdit avec l'objet QR", async () => {
        const user = userEvent.setup()
        const qr = mkQR()
        renderQRCard(qr)
        await user.click(screen.getByRole("button", { name: new RegExp(UI_TEXT.fr.edit, "i") }))
        expect(mocks.onEdit).toHaveBeenCalledWith(qr)
    })

    test("le bouton Supprimer appelle onDelete avec l'objet QR", async () => {
        const user = userEvent.setup()
        const qr = mkQR()
        renderQRCard(qr)
        await user.click(screen.getByRole("button", { name: new RegExp(UI_TEXT.fr.delete, "i") }))
        expect(mocks.onDelete).toHaveBeenCalledWith(qr)
    })
})

describe("QRCard — permission bibliotheque.manage", () => {
    test("sans la permission, Modifier et Supprimer ne sont pas rendus", () => {
        mocks.canManage = false
        renderQRCard(mkQR())
        expect(
            screen.queryByRole("button", { name: new RegExp(UI_TEXT.fr.edit, "i") })
        ).not.toBeInTheDocument()
        expect(
            screen.queryByRole("button", { name: new RegExp(UI_TEXT.fr.delete, "i") })
        ).not.toBeInTheDocument()
    })

    test("sans la permission, le bouton Formats reste disponible (consultation)", () => {
        mocks.canManage = false
        renderQRCard(mkQR())
        expect(
            screen.getByRole("button", { name: new RegExp(UI_TEXT.fr.format, "i") })
        ).toBeInTheDocument()
    })
})

describe("QRCard — bouton Formater", () => {
    test("le clic sur Formater ouvre le pop-up (onViewFormat) avec l'objet QR", async () => {
        const user = userEvent.setup()
        const qr = mkQR()
        renderQRCard(qr)
        await user.click(screen.getByRole("button", { name: new RegExp(UI_TEXT.fr.format, "i") }))
        expect(mocks.onViewFormat).toHaveBeenCalledWith(qr)
    })
})
