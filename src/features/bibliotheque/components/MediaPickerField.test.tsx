// ── MediaPickerField.test.tsx ─────────────────────────────────────────────────
// Tests unitaires de MediaPickerField — extrait de ThematiqueFormDialog.tsx
// (voir son en-tête). Le comportement (upload en cours, aperçu, désactivation)
// reste couvert en intégration par ThematiqueFormDialog.upload.test.tsx ; ici
// on vérifie le composant isolément.

import { describe, expect, test, rstest } from "@rstest/core"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { RefObject } from "react"
import { MediaPickerField } from "./MediaPickerField"

function baseProps() {
    return {
        id: "topic-image",
        label: "Image",
        previewUrl: "",
        previewClassName: "w-14 h-14",
        inputRef: { current: null } as RefObject<HTMLInputElement | null>,
        accept: "image/*",
        uploading: false,
        disabled: false,
        chooseLabel: "Choisir une image…",
        uploadingLabel: "Envoi…",
        onChange: rstest.fn(),
    }
}

describe("MediaPickerField", () => {
    test("affiche le label et le bouton de choix", () => {
        render(<MediaPickerField {...baseProps()} />)
        expect(screen.getByText("Image")).toBeInTheDocument()
        expect(screen.getByRole("button", { name: /Choisir une image/ })).toBeInTheDocument()
    })

    test("n'affiche aucune image d'aperçu si previewUrl est vide", () => {
        render(<MediaPickerField {...baseProps()} />)
        expect(screen.queryByRole("img")).not.toBeInTheDocument()
    })

    test("affiche l'aperçu quand previewUrl est renseigné", () => {
        render(<MediaPickerField {...baseProps()} previewUrl="https://cdn.example.com/x.png" />)
        const img = screen.getByRole("presentation") ?? screen.getByAltText("")
        expect(img).toHaveAttribute("src", "https://cdn.example.com/x.png")
    })

    test("affiche l'état 'uploading' (libellé + spinner) au lieu du bouton normal", () => {
        render(<MediaPickerField {...baseProps()} uploading={true} />)
        expect(screen.getByText("Envoi…")).toBeInTheDocument()
        expect(screen.queryByText("Choisir une image…")).not.toBeInTheDocument()
    })

    test("le bouton est désactivé quand disabled=true", () => {
        render(<MediaPickerField {...baseProps()} disabled={true} />)
        expect(screen.getByRole("button")).toBeDisabled()
    })

    test("affiche le hint quand fourni", () => {
        render(<MediaPickerField {...baseProps()} hint="Le nom est requis" />)
        expect(screen.getByText("Le nom est requis")).toBeInTheDocument()
    })

    test("cliquer sur le bouton déclenche un clic sur l'input file caché", async () => {
        const user = userEvent.setup()
        const props = baseProps()
        const clickSpy = rstest.fn()
        render(<MediaPickerField {...props} />)
        const input = document.getElementById("topic-image") as HTMLInputElement
        input.click = clickSpy
        await user.click(screen.getByRole("button"))
        expect(clickSpy).toHaveBeenCalledTimes(1)
    })

    test("onChange est appelé quand un fichier est sélectionné", async () => {
        const user = userEvent.setup()
        const onChange = rstest.fn()
        render(<MediaPickerField {...baseProps()} onChange={onChange} />)
        const file = new File(["x"], "photo.png", { type: "image/png" })
        await user.upload(document.getElementById("topic-image") as HTMLInputElement, file)
        expect(onChange).toHaveBeenCalledTimes(1)
    })
})
