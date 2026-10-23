// ── QRFormDialog.tsx ──────────────────────────────────────────────────────────
// RÔLE : Dialog de création / modification d'une Q&R.
//
// Un seul composant gère deux modes (évite la duplication du JSX) :
//   - "create-qr" → quatre champs vides, bouton "Ajouter"
//   - "edit-qr"   → champs pré-remplis avec la Q&R existante, bouton "Enregistrer"
//
// Initialisation : les champs sont initialisés dans onOpenAutoFocus (pas au
// premier rendu). Cette approche garantit qu'à chaque ouverture — même si le
// composant était déjà monté en mémoire — les champs affichent la bonne valeur.
//
// Mise en page : deux colonnes FR (gauche) / EN (droite) avec des Textarea.
// Les labels de la colonne EN utilisent toujours UI_TEXT.en (jamais traduit),
// pour que l'utilisateur sache toujours quelle colonne est en anglais.
//
// CE FICHIER EST IMPORTÉ PAR :
//   - routes/Bibliotheque.tsx → monté en dehors du layout, toujours disponible
//
// CE FICHIER IMPORTE :
//   - context/BiblioContext.tsx → lit dialog, closeDialog, handleSaveQR, ui

import { useState } from "react"
import { useBiblioContext } from "../context/BiblioContext"
import { UI_TEXT } from "../constants"
import { tLabel } from "../utils"
import { DialogSaveFooter } from "./DialogSaveFooter"
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/shared/ui/atoms/dialog"
import { Textarea } from "@/shared/ui/atoms/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/atoms/select"

export function QRFormDialog() {
    const {
        data: { thematiques },
        nav: { lang, ui, activeId },
        dialogs: { dialog, closeDialog },
        handlers: { handleSaveQR },
    } = useBiblioContext()

    // Le dialog est ouvert si le mode est "create-qr" ou "edit-qr"
    const open = dialog?.mode === "create-qr" || dialog?.mode === "edit-qr"

    // En mode "edit-qr", on récupère la Q&R existante pour pré-remplir le formulaire
    const initial = dialog?.mode === "edit-qr" ? dialog.qr : null

    // États locaux du formulaire — initialisés vides ; onOpenAutoFocus est
    // la seule source d'initialisation (évite de dupliquer la logique).
    // Chaque useState crée une paire [valeur actuelle, fonction pour la modifier] :
    // ce sont des champs "contrôlés" — la valeur affichée dans le <Textarea> vient
    // toujours de ce state, et chaque frappe au clavier appelle set... via onChange
    // (voir plus bas) pour le mettre à jour, ce qui redessine le composant.
    const [question, setQuestion] = useState("")
    const [briefQr, setBriefQr] = useState("")
    const [questionEn, setQuestionEn] = useState("")
    const [briefQrEn, setBriefQrEn] = useState("")
    // Thématique à laquelle la Q&R appartient (modifiable via le select ci-dessous)
    const [thematiqueId, setThematiqueId] = useState("")

    // Protège contre la double soumission : désactive le bouton pendant l'opération
    const [isSaving, setIsSaving] = useState(false)

    async function handleSubmit() {
        setIsSaving(true)
        try {
            await handleSaveQR(question.trim(), briefQr.trim(), questionEn.trim(), briefQrEn.trim(), thematiqueId)
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!o && !isSaving) closeDialog() }}>
            <DialogContent
                // onOpenAutoFocus : s'exécute à chaque ouverture, qu'il s'agisse
                // d'un premier montage ou d'une réouverture (forceMount, animation).
                // C'est le seul endroit où les champs sont initialisés.
                onOpenAutoFocus={() => {
                    setQuestion(initial?.question ?? "")
                    setBriefQr(initial?.briefQr ?? "")
                    setQuestionEn(initial?.questionEn ?? "")
                    setBriefQrEn(initial?.briefQrEn ?? "")
                    setThematiqueId(initial?.thematiqueId ?? activeId)
                    setIsSaving(false)
                }}
                className="w-biblio-dialog max-w-5xl"
            >
                <DialogHeader>
                    <DialogTitle>{initial ? ui.editQuestion : ui.newQuestion}</DialogTitle>
                </DialogHeader>

                {/* Thématique d'appartenance — modifiable indépendamment du contenu FR/EN */}
                <div className="flex flex-col gap-1.5">
                    <label htmlFor="qr-thematique" className="text-sm font-medium">{ui.thematiqueLabel}</label>
                    {/* Select/SelectTrigger/SelectContent/SelectItem : liste déroulante
                        accessible fournie par le design system. .map() transforme chaque
                        thématique du tableau "thematiques" en une option cliquable ; "key"
                        (l'id, unique) aide React à suivre quelle option correspond à quel
                        élément de la liste. */}
                    <Select value={thematiqueId} onValueChange={setThematiqueId}>
                        <SelectTrigger id="qr-thematique">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {thematiques.map((t) => (
                                <SelectItem key={t.id} value={t.id}>{tLabel(t, lang)}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Grille 2 colonnes : français à gauche, anglais à droite */}
                <div className="grid grid-cols-2 gap-6 py-2">
                    <div className="flex flex-col gap-4">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{ui.sectionFr}</p>
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor="qr-question-fr" className="text-sm font-medium">{ui.questionLabel}</label>
                            <Textarea id="qr-question-fr" value={question} onChange={(e) => setQuestion(e.target.value)} rows={3}
                                placeholder={ui.questionPlaceholder} className="resize-none"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor="qr-brief-fr" className="text-sm font-medium">{ui.reponseLabel}</label>
                            <Textarea id="qr-brief-fr" value={briefQr} onChange={(e) => setBriefQr(e.target.value)} rows={15}
                                placeholder={ui.reponsePlaceholder} className="resize-none"
                            />
                        </div>
                    </div>
                    <div className="flex flex-col gap-4">
                        {/* UI_TEXT.en pour toujours avoir les labels en anglais dans la colonne EN */}
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{ui.sectionEn}</p>
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor="qr-question-en" className="text-sm font-medium">{UI_TEXT.en.questionLabel}</label>
                            <Textarea id="qr-question-en" value={questionEn} onChange={(e) => setQuestionEn(e.target.value)} rows={3}
                                placeholder={UI_TEXT.en.questionPlaceholder} className="resize-none"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor="qr-brief-en" className="text-sm font-medium">{UI_TEXT.en.reponseLabel}</label>
                            <Textarea id="qr-brief-en" value={briefQrEn} onChange={(e) => setBriefQrEn(e.target.value)} rows={15}
                                placeholder={UI_TEXT.en.reponsePlaceholder} className="resize-none"
                            />
                        </div>
                    </div>
                </div>

                {/* DialogSaveFooter : composant partagé qui affiche les boutons Annuler /
                    Enregistrer d'un dialog (avec spinner de chargement pendant la sauvegarde),
                    pour ne pas recopier ce bloc dans chaque dialog de la feature.
                    Bouton "save" désactivé tant que les champs obligatoires sont vides ou
                    qu'une sauvegarde est en cours. FR et EN sont tous les deux obligatoires :
                    la question et la réponse ne doivent jamais être enregistrées dans une
                    seule langue. */}
                <DialogSaveFooter
                    isSaving={isSaving}
                    saveDisabled={
                        isSaving || !thematiqueId
                        || !question.trim() || !briefQr.trim()
                        || !questionEn.trim() || !briefQrEn.trim()
                    }
                    savingLabel={ui.saving}
                    saveLabel={initial ? ui.save : ui.add}
                    cancelLabel={ui.cancel}
                    onSave={handleSubmit}
                />
            </DialogContent>
        </Dialog>
    )
}
