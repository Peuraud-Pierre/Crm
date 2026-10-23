// ── BriefChiffresDialogs.tsx ──────────────────────────────────────────────────
// RÔLE : Dialogs de modification du brief global (Règles d'or) et des chiffres clés.
//
// Même principe DRY que DeleteDialogs.tsx : les deux dialogs ont exactement la même
// mise en page (deux colonnes FR | EN, deux grandes zones de texte, même footer).
// La mise en page est factorisée dans DualTextareaDialog (composant interne).
//
// requireBothFilled (prop optionnelle) :
//   - true pour le brief : les deux langues sont obligatoires
//   - false (défaut) pour les chiffres : on peut remplir une seule langue
//
// onOpenAutoFocus : à chaque ouverture, on réinitialise les champs avec les valeurs
// actuelles du brief (pas les valeurs du précédent formulaire ouvert).
//
// CE FICHIER EST IMPORTÉ PAR :
//   - routes/Bibliotheque.tsx → monte BriefEditDialog et ChiffresEditDialog
//
// CE FICHIER IMPORTE :
//   - context/BiblioContext.tsx → lit brief, dialog, closeDialog, handleSaveBrief, etc.

import { useState } from "react"
import { useBiblioContext } from "../context/BiblioContext"
import { UI_TEXT } from "../constants"
import { DialogSaveFooter } from "./DialogSaveFooter"
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/shared/ui/atoms/dialog"
import { Textarea } from "@/shared/ui/atoms/textarea"

const LABEL_CLASS = "text-xs font-semibold text-muted-foreground uppercase tracking-widest"

// ── Primitif partagé ──────────────────────────────────────────────────────────

interface DualTextareaDialogProps {
    open: boolean
    title: string
    idFr: string
    idEn: string
    placeholderFr: string
    placeholderEn: string
    initialFr: string
    initialEn: string
    requireBothFilled?: boolean
    onSave: (fr: string, en: string) => Promise<void>
    onClose: () => void
}

function DualTextareaDialog({
    open, title,
    idFr, idEn,
    placeholderFr, placeholderEn,
    initialFr, initialEn,
    requireBothFilled,
    onSave, onClose,
}: DualTextareaDialogProps) {
    const { nav: { ui } } = useBiblioContext()
    // useState("") crée une variable réactive initialisée à une chaîne vide,
    // avec sa fonction de mise à jour associée (le composant se re-rend à
    // chaque appel de setValueFr/setValueEn/setIsSaving).
    const [valueFr, setValueFr] = useState("")
    const [valueEn, setValueEn] = useState("")
    const [isSaving, setIsSaving] = useState(false) // true pendant l'appel réseau onSave

    async function handleSubmit() {
        setIsSaving(true)
        try {
            await onSave(valueFr.trim(), valueEn.trim())
        } finally {
            // "finally" s'exécute toujours, que onSave réussisse ou lève une erreur :
            // on réactive donc le bouton dans tous les cas.
            setIsSaving(false)
        }
    }

    // Le bouton Enregistrer est désactivé si une sauvegarde est en cours,
    // si requireBothFilled est true et qu'un des deux champs est vide,
    // ou — quel que soit requireBothFilled — si un seul des deux champs est
    // rempli (un contenu FR sans son équivalent EN, ou vice versa, ne doit
    // jamais pouvoir être enregistré).
    const trimmedFr = valueFr.trim()
    const trimmedEn = valueEn.trim()
    const onlyOneFilled = Boolean(trimmedFr) !== Boolean(trimmedEn)
    const saveDisabled = isSaving || onlyOneFilled || (requireBothFilled ? !trimmedFr || !trimmedEn : false)

    return (
        // <Dialog> vient de Radix UI (la librairie de composants accessibles utilisée
        // par le design system) : elle gère l'ouverture/fermeture, le focus piégé dans
        // la fenêtre modale et la fermeture au clavier (Échap), sans qu'on ait à le
        // recoder. "open" contrôle si la modale est visible ; onOpenChange est appelé
        // par Radix quand l'utilisateur essaie de la fermer (clic dehors, Échap...) —
        // on n'autorise la fermeture (onClose) que si aucune sauvegarde n'est en cours.
        <Dialog open={open} onOpenChange={(o: boolean) => { if (!o && !isSaving) onClose() }}>
            <DialogContent
                // onOpenAutoFocus se déclenche à chaque ouverture de la modale : on en
                // profite pour réinitialiser les champs avec les valeurs actuelles du
                // brief, plutôt que de garder ce qui avait été saisi lors d'une
                // précédente ouverture.
                onOpenAutoFocus={() => {
                    setValueFr(initialFr)
                    setValueEn(initialEn)
                    setIsSaving(false)
                }}
                className="w-biblio-dialog max-w-5xl"
            >
                <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>

                <div className="grid grid-cols-2 gap-6 py-2">
                    <div className="flex flex-col gap-1.5">
                        <label htmlFor={idFr} className={LABEL_CLASS}>{ui.sectionFr}</label>
                        <Textarea
                            id={idFr}
                            value={valueFr}
                            onChange={(e) => setValueFr(e.target.value)}
                            rows={15}
                            placeholder={placeholderFr}
                            className="resize-none"
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label htmlFor={idEn} className={LABEL_CLASS}>{ui.sectionEn}</label>
                        <Textarea
                            id={idEn}
                            value={valueEn}
                            onChange={(e) => setValueEn(e.target.value)}
                            rows={15}
                            placeholder={placeholderEn}
                            className="resize-none"
                        />
                    </div>
                </div>

                <DialogSaveFooter
                    isSaving={isSaving}
                    saveDisabled={saveDisabled}
                    savingLabel={ui.saving}
                    saveLabel={ui.save}
                    cancelLabel={ui.cancel}
                    onSave={handleSubmit}
                />
            </DialogContent>
        </Dialog>
    )
}

// ── Exports publics ───────────────────────────────────────────────────────────

export function BriefEditDialog() {
    const { data: { brief }, nav: { ui }, dialogs: { dialog, closeDialog }, handlers: { handleSaveBrief } } = useBiblioContext()
    return (
        <DualTextareaDialog
            open={dialog?.mode === "edit-brief"}
            title={ui.editBriefTitle}
            idFr="brief-fr"
            idEn="brief-en"
            initialFr={brief.brief}
            initialEn={brief.briefEn}
            placeholderFr={ui.briefPlaceholder}
            placeholderEn={UI_TEXT.en.briefPlaceholder}
            requireBothFilled
            onSave={handleSaveBrief}
            onClose={closeDialog}
        />
    )
}

export function ChiffresEditDialog() {
    const { data: { brief }, nav: { ui }, dialogs: { dialog, closeDialog }, handlers: { handleSaveChiffres } } = useBiblioContext()
    return (
        <DualTextareaDialog
            open={dialog?.mode === "edit-chiffres"}
            title={ui.chiffresTitle}
            idFr="chiffres-fr"
            idEn="chiffres-en"
            initialFr={brief.chiffres}
            initialEn={brief.chiffresEn}
            placeholderFr={ui.chiffresPlaceholder}
            placeholderEn={UI_TEXT.en.chiffresPlaceholder}
            onSave={handleSaveChiffres}
            onClose={closeDialog}
        />
    )
}
