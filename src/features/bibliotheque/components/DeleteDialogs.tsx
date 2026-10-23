// ── DeleteDialogs.tsx ─────────────────────────────────────────────────────────
// RÔLE : Dialogs de confirmation de suppression (Q&R et thématiques).
//
// Architecture — le principe DRY ("Don't Repeat Yourself") :
//   Les deux dialogs (supprimer une Q&R, supprimer une thématique) ont la même
//   structure : icône danger + message + boutons Annuler/Supprimer + état isSaving.
//   Plutôt que de dupliquer ce code, on le factorise dans DeleteConfirmDialog
//   (composant interne, non exporté) qui reçoit les textes et callbacks en props.
//
// Le paramètre optionnel "warning" permet d'afficher un encart rouge supplémentaire.
// Il est utilisé quand on supprime une thématique qui contient des Q&R : elles
// seront supprimées en cascade par la base de données.
//
// isSaving : protège contre la double soumission (bouton désactivé pendant l'appel).
//
// CE FICHIER EST IMPORTÉ PAR :
//   - routes/Bibliotheque.tsx → monte DeleteQRDialog et DeleteThematiqueDialog
//
// CE FICHIER IMPORTE :
//   - context/BiblioContext.tsx → lit dialog, closeDialog, et les handlers

import { useState } from "react"
import { useBiblioContext } from "../context/BiblioContext"
import { tQuestion, tLabel } from "../utils"
import { DialogSaveFooter } from "./DialogSaveFooter"
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/shared/ui/atoms/dialog"
import { AlertTriangle } from "lucide-react"

// ── Primitif partagé ──────────────────────────────────────────────────────────
// DeleteConfirmDialog n'est pas exporté — c'est un composant interne réutilisé
// uniquement par les deux exports publics ci-dessous.

interface DeleteConfirmDialogProps {
    open: boolean           // le dialog est-il ouvert ?
    title: string           // titre affiché dans la modale
    message: string         // texte de confirmation (ex: "Voulez-vous supprimer X ?")
    warning?: string        // (optionnel) encart rouge pour avertissement cascade
    onConfirm: () => Promise<void>  // action de suppression (appelée au clic Supprimer)
    onClose: () => void     // ferme le dialog sans supprimer
}

function DeleteConfirmDialog({ open, title, message, warning, onConfirm, onClose }: DeleteConfirmDialogProps) {
    const { nav: { ui } } = useBiblioContext()
    // isSaving : true pendant l'appel async → désactive les boutons pour éviter
    // une double soumission si l'utilisateur clique deux fois rapidement
    const [isSaving, setIsSaving] = useState(false)

    async function handleSubmit() {
        setIsSaving(true)
        try {
            await onConfirm() // appel du handler CRUD via useBiblioPage
        } finally {
            // finally s'exécute toujours, succès ou erreur → on remet le bouton actif
            setIsSaving(false)
        }
    }

    return (
        // <Dialog> (Radix UI, via le design system) gère l'ouverture/fermeture de la
        // fenêtre modale, le focus et la fermeture au clavier (Échap). onOpenChange
        // est appelé quand l'utilisateur tente de fermer (clic dehors, Échap...) ; on
        // n'appelle onClose que si aucune suppression n'est en cours.
        <Dialog open={open} onOpenChange={(o: boolean) => { if (!o && !isSaving) onClose() }}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-destructive" /> {title}
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-2 text-sm text-muted-foreground">
                    <p>{message}</p>
                    {/* Rendu conditionnel avec && : l'encart d'avertissement ne s'affiche
                        que si "warning" a été fourni (sinon undefined = "falsy", rien
                        n'est rendu). */}
                    {warning && (
                        <p className="rounded-md bg-destructive/10 text-destructive px-3 py-2 text-xs font-medium">
                            {warning}
                        </p>
                    )}
                </div>
                <DialogSaveFooter
                    variant="destructive"
                    isSaving={isSaving}
                    saveDisabled={isSaving}
                    savingLabel={ui.deleting}
                    saveLabel={ui.delete}
                    cancelLabel={ui.cancel}
                    onSave={handleSubmit}
                />
            </DialogContent>
        </Dialog>
    )
}

// ── Exports publics ───────────────────────────────────────────────────────────

// Dialog de suppression d'une Q&R.
// On extrait la Q&R depuis dialog.mode pour construire les textes dynamiques.
// open={qr !== null} : le dialog s'ouvre dès que dialog.mode === "delete-qr"
export function DeleteQRDialog() {
    const { nav: { lang, ui }, dialogs: { dialog, closeDialog }, handlers: { handleDeleteQR } } = useBiblioContext()
    const qr = dialog?.mode === "delete-qr" ? dialog.qr : null
    return (
        <DeleteConfirmDialog
            open={qr !== null}
            title={ui.deleteQuestion}
            // ui.deleteQuestionConfirm est une fonction qui génère le message avec le nom
            message={qr ? ui.deleteQuestionConfirm(tQuestion(qr, lang)) : ""}
            onConfirm={handleDeleteQR}
            onClose={closeDialog}
        />
    )
}

// Dialog de suppression d'une thématique.
// Si la thématique a des Q&R (qrCount > 0), on affiche un avertissement en rouge
// pour informer l'utilisateur que les Q&R seront supprimées en cascade.
export function DeleteThematiqueDialog() {
    const { data: { countByThematique }, nav: { lang, ui }, dialogs: { dialog, closeDialog }, handlers: { handleDeleteThematique } } = useBiblioContext()
    const thematique = dialog?.mode === "delete-thematique" ? dialog.thematique : null
    // Nombre de Q&R dans cette thématique (0 si la thématique n'existe pas encore)
    const qrCount = thematique ? (countByThematique[thematique.id] ?? 0) : 0
    return (
        <DeleteConfirmDialog
            open={thematique !== null}
            title={ui.deleteTopic}
            message={thematique ? ui.deleteTopicConfirm(tLabel(thematique, lang)) : ""}
            // warning uniquement si des Q&R existent — sinon pas d'encart rouge
            warning={qrCount > 0 ? ui.deleteTopicWarning(qrCount) : undefined}
            onConfirm={handleDeleteThematique}
            onClose={closeDialog}
        />
    )
}
