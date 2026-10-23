import { describe, expect, rstest, test } from "@rstest/core"
import { render, screen, fireEvent } from "@testing-library/react"
import type { ReactNode } from "react"
import { Dialog } from "@/shared/ui/atoms/dialog"
import { DialogSaveFooter } from "./DialogSaveFooter"

// DialogFooter/DialogClose exigent un contexte Radix Dialog (open pour éviter
// que le contenu ne soit démonté par le portail hors écran).
function withDialog(children: ReactNode) {
    return <Dialog open>{children}</Dialog>
}

describe("DialogSaveFooter", () => {
    test("affiche le libellé Enregistrer et appelle onSave au clic", () => {
        const onSave = rstest.fn()
        render(withDialog(
            <DialogSaveFooter
                isSaving={false}
                saveDisabled={false}
                savingLabel="Enregistrement…"
                saveLabel="Enregistrer"
                cancelLabel="Annuler"
                onSave={onSave}
            />
        ))

        fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }))
        expect(onSave).toHaveBeenCalledTimes(1)
    })

    test("pendant la sauvegarde : affiche le libellé savingLabel et désactive le bouton Annuler par défaut", () => {
        render(withDialog(
            <DialogSaveFooter
                isSaving={true}
                saveDisabled={true}
                savingLabel="Enregistrement…"
                saveLabel="Enregistrer"
                cancelLabel="Annuler"
                onSave={() => {}}
            />
        ))

        expect(screen.getByText("Enregistrement…")).toBeInTheDocument()
        expect(screen.queryByText("Enregistrer")).not.toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Annuler" })).toBeDisabled()
        expect(screen.getByRole("button", { name: /Enregistrement/ })).toBeDisabled()
    })

    test("cancelDisabled explicite prime sur isSaving (cas ThematiqueFormDialog : upload en vol, pas encore de sauvegarde)", () => {
        render(withDialog(
            <DialogSaveFooter
                isSaving={false}
                saveDisabled={true}
                cancelDisabled={true}
                savingLabel="Enregistrement…"
                saveLabel="Créer"
                cancelLabel="Annuler"
                onSave={() => {}}
            />
        ))

        expect(screen.getByRole("button", { name: "Annuler" })).toBeDisabled()
    })

    test("variant='destructive' (cas DeleteConfirmDialog) : le bouton principal porte la classe destructive", () => {
        render(withDialog(
            <DialogSaveFooter
                variant="destructive"
                isSaving={false}
                saveDisabled={false}
                savingLabel="Suppression…"
                saveLabel="Supprimer"
                cancelLabel="Annuler"
                onSave={() => {}}
            />
        ))

        expect(screen.getByRole("button", { name: "Supprimer" }).className).toContain("destructive")
    })

    test("variant par défaut ('default') : le bouton principal ne porte pas la classe destructive", () => {
        render(withDialog(
            <DialogSaveFooter
                isSaving={false}
                saveDisabled={false}
                savingLabel="Enregistrement…"
                saveLabel="Enregistrer"
                cancelLabel="Annuler"
                onSave={() => {}}
            />
        ))

        expect(screen.getByRole("button", { name: "Enregistrer" }).className).not.toContain("destructive")
    })
})
