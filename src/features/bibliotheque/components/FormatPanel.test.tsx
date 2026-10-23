// ── FormatPanel.test.tsx ──────────────────────────────────────────────────────
// Tests unitaires de FormatPanel — jusqu'ici sans aucun test malgré une
// logique d'état non triviale : bascule d'onglet, message d'invite quand
// `reponses` est undefined, et le bouton Copier (feedback visuel temporaire,
// dépendance à l'API navigator.clipboard qui n'existe pas nativement dans jsdom).

import { describe, expect, test, rstest, beforeEach } from "@rstest/core"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { UI_TEXT } from "../constants"
import type { FormatMap, Lang } from "../types"

const mocks = rstest.hoisted(() => ({ lang: "fr" as Lang, toastError: rstest.fn() }))

function mockBiblioContextValue() {
    return { nav: { ui: UI_TEXT[mocks.lang as Lang], lang: mocks.lang } }
}

rstest.mock("@/features/bibliotheque/context/BiblioContext", () => ({
    useBiblioContext: mockBiblioContextValue,
}))

rstest.mock("sonner", () => ({
    toast: { error: mocks.toastError, success: rstest.fn() },
}))

import { FormatPanel } from "./FormatPanel"

const mkMap = (overrides: Partial<FormatMap> = {}): FormatMap => ({
    email: "Réponse email", emailEn: "Email reply",
    instagram: "Réponse insta", instagramEn: "Insta reply",
    whatsapp: "Réponse whatsapp", whatsappEn: "Whatsapp reply",
    ...overrides,
})

// navigator.clipboard est un objet global unique (pas modularisé) — pour
// éviter toute ambiguïté entre tests, chaque test qui l'exerce le redéfinit
// avec son propre mock local via mockClipboard(), plutôt que de partager un
// mock reconfiguré en beforeEach.
function mockClipboard(behavior: "resolve" | "reject") {
    const writeText = behavior === "resolve"
        ? rstest.fn().mockResolvedValue(undefined)
        : rstest.fn().mockRejectedValue(new Error("denied"))
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true })
    return writeText
}

beforeEach(() => {
    rstest.clearAllMocks()
    mocks.lang = "fr"
})

describe("FormatPanel — état vide", () => {
    test("affiche le message d'invite (mode éditable) quand reponses est undefined", () => {
        render(<FormatPanel reponses={undefined} />)
        expect(screen.getByText(UI_TEXT.fr.noFormatted)).toBeInTheDocument()
    })

    test("affiche le message d'invite en lecture seule quand reponses est undefined et readOnly=true", () => {
        render(<FormatPanel reponses={undefined} readOnly />)
        expect(screen.getByText(UI_TEXT.fr.noFormattedReadOnly)).toBeInTheDocument()
    })
})

describe("FormatPanel — onglets", () => {
    test("affiche le texte du canal email par défaut", () => {
        render(<FormatPanel reponses={mkMap()} />)
        expect(screen.getByRole("textbox")).toHaveValue("Réponse email")
    })

    test("cliquer sur l'onglet WhatsApp affiche le texte du canal WhatsApp", async () => {
        const user = userEvent.setup()
        render(<FormatPanel reponses={mkMap()} />)
        await user.click(screen.getByRole("button", { name: /whatsapp/i }))
        expect(screen.getByRole("textbox")).toHaveValue("Réponse whatsapp")
    })

    test("le texte affiché suit la langue active (EN)", () => {
        mocks.lang = "en"
        render(<FormatPanel reponses={mkMap()} />)
        expect(screen.getByRole("textbox")).toHaveValue("Email reply")
    })
})

describe("FormatPanel — bouton Modifier", () => {
    test("visible et appelle onEdit en mode éditable", async () => {
        const user = userEvent.setup()
        const onEdit = rstest.fn()
        render(<FormatPanel reponses={mkMap()} onEdit={onEdit} />)
        await user.click(screen.getByRole("button", { name: UI_TEXT.fr.edit }))
        expect(onEdit).toHaveBeenCalledTimes(1)
    })

    test("absent en mode readOnly", () => {
        render(<FormatPanel reponses={mkMap()} readOnly />)
        expect(screen.queryByRole("button", { name: UI_TEXT.fr.edit })).not.toBeInTheDocument()
    })
})

describe("FormatPanel — copier", () => {
    test("copie le texte du canal actif et affiche un feedback temporaire", async () => {
        const user = userEvent.setup()
        const writeText = mockClipboard("resolve")
        render(<FormatPanel reponses={mkMap()} />)
        await user.click(screen.getByRole("button", { name: UI_TEXT.fr.copy }))
        expect(writeText).toHaveBeenCalledWith("Réponse email")
        await waitFor(() => {
            expect(screen.getByRole("button", { name: UI_TEXT.fr.copied })).toBeInTheDocument()
        })
    })

    test("affiche un toast d'erreur si le presse-papiers échoue", async () => {
        const user = userEvent.setup()
        mockClipboard("reject")
        render(<FormatPanel reponses={mkMap()} />)
        await user.click(screen.getByRole("button", { name: UI_TEXT.fr.copy }))
        await waitFor(() => {
            expect(mocks.toastError).toHaveBeenCalledWith(UI_TEXT.fr.errCopy)
        })
        // Le bouton reste sur "Copier" (pas de feedback ✓) puisque la copie a échoué
        expect(screen.getByRole("button", { name: UI_TEXT.fr.copy })).toBeInTheDocument()
    })
})
