// ── FormatEditDialog.tsx ──────────────────────────────────────────────────────
// RÔLE : Dialog d'édition des réponses formatées par canal (Email / DM / WhatsApp).
//
// Fonctionnement :
//   - S'ouvre quand dialog.mode === "edit-format" (via openEditFormat, appelé par
//     le bouton "Modifier" de FormatPanel dans le pop-up FormatViewDialog)
//   - Interface à onglets : un onglet par canal
//   - Chaque onglet affiche FR (gauche) et EN (droite) côte à côte
//   - Toutes les valeurs sont stockées dans un seul objet `values: FormatMap`
//     pour n'avoir qu'un seul appel upsert à la sauvegarde
//
// Astuce pour les Textarea par onglet :
//   La prop `key={tab + "-fr"}` force React à recréer le Textarea quand on change
//   d'onglet. Sans ça, React réutilise le même DOM et le curseur ou la sélection
//   de texte peuvent se mélanger entre deux onglets.
//
// allEmpty : le bouton Enregistrer est désactivé si TOUS les canaux sont vides.
// On permet d'enregistrer même si un seul canal est rempli.
//
// EMPTY : objet FormatMap initialisé avec des chaînes vides, utilisé quand aucun
// format n'a encore été créé pour cette Q&R.
//
// CE FICHIER EST IMPORTÉ PAR :
//   - routes/Bibliotheque.tsx → monté en dehors du layout, toujours disponible
//
// CE FICHIER IMPORTE :
//   - context/BiblioContext.tsx → lit formatReponses, dialog, closeDialog, handleSaveFormat

import { useState } from "react"
import type { FormatMap, FormatChannel } from "../types"
import { FORMAT_LABELS, FORMAT_CHANNELS, iconPath, UI_TEXT } from "../constants"
import { tQuestion } from "../utils"
import { useBiblioContext } from "../context/BiblioContext"
import { MaskIcon } from "./MaskIcon"
import { DialogSaveFooter } from "./DialogSaveFooter"
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/shared/ui/atoms/dialog"
import { Textarea } from "@/shared/ui/atoms/textarea"
import { cn } from "@/shared/lib/utils"

const EMPTY: FormatMap = {
    email: "", emailEn: "",
    instagram: "", instagramEn: "",
    whatsapp: "", whatsappEn: "",
}

export function FormatEditDialog() {
    const { data: { formatReponses }, nav: { lang, ui }, dialogs: { dialog, closeDialog }, handlers: { handleSaveFormat } } = useBiblioContext()

    const open = dialog?.mode === "edit-format"
    const qr = dialog?.mode === "edit-format" ? dialog.qr : null
    // current : formats existants pour cette Q&R (undefined si jamais créés)
    const current = qr ? formatReponses[qr.id] : undefined

    // useState<FormatChannel>("email") crée une variable réactive "tab" (canal
    // actif dans l'interface à onglets) et sa fonction de mise à jour setTab :
    // l'appeler redéclenche un rendu du composant avec le nouvel onglet.
    const [tab, setTab] = useState<FormatChannel>("email")
    // values : objet contenant les 6 champs (email FR, email EN, instagram FR, etc.)
    // Initialisé à EMPTY puis rempli dans onOpenAutoFocus
    const [values, setValues] = useState<FormatMap>(EMPTY)
    const [isSaving, setIsSaving] = useState(false)

    async function handleSubmit() {
        setIsSaving(true)
        try {
            // On passe l'objet entier (tous les canaux) en une seule fois
            await handleSaveFormat({
                email: values.email.trim(),
                emailEn: values.emailEn.trim(),
                instagram: values.instagram.trim(),
                instagramEn: values.instagramEn.trim(),
                whatsapp: values.whatsapp.trim(),
                whatsappEn: values.whatsappEn.trim(),
            })
        } finally {
            setIsSaving(false)
        }
    }

    // setFr : met à jour le champ FR du canal actif dans values
    // [tab] est une "computed property" — tab vaut "email" | "instagram" | "whatsapp"
    function setFr(v: string) {
        setValues((p) => ({ ...p, [tab]: v }))
    }
    // setEn : met à jour le champ EN du canal actif
    // `${tab}En` génère dynamiquement "emailEn" | "instagramEn" | "whatsappEn"
    function setEn(v: string) {
        const key = `${tab}En` as keyof FormatMap
        setValues((p) => ({ ...p, [key]: v }))
    }

    // allEmpty : true si TOUS les canaux (FR+EN) sont vides → désactive "Enregistrer"
    // FORMAT_CHANNELS.every() retourne true uniquement si le prédicat est vrai pour tous les éléments
    const allEmpty = FORMAT_CHANNELS.every(
        (ch) => !values[ch].trim() && !(values[`${ch}En` as keyof FormatMap] as string).trim()
    )
    // hasMismatch : true si, pour au moins un canal, une seule des deux langues
    // est remplie (ex. Email FR rempli mais Email EN vide) → désactive
    // "Enregistrer" tant que les deux langues ne sont pas alignées.
    const hasMismatch = FORMAT_CHANNELS.some((ch) => {
        const fr = values[ch].trim()
        const en = (values[`${ch}En` as keyof FormatMap] as string).trim()
        return Boolean(fr) !== Boolean(en)
    })

    return (
        // <Dialog> (Radix UI, via le design system) gère l'ouverture/fermeture et le
        // focus de la fenêtre modale. onOpenChange est appelé quand l'utilisateur
        // tente de la fermer (clic dehors, Échap...) ; on ne ferme réellement que si
        // aucune sauvegarde n'est en cours.
        <Dialog open={open} onOpenChange={(o) => { if (!o && !isSaving) closeDialog() }}>
            <DialogContent
                // onOpenAutoFocus se déclenche à chaque ouverture de la modale : on
                // réinitialise l'onglet et les valeurs des champs avec les données
                // actuelles de la Q&R, plutôt que de garder ce qui restait de la
                // précédente ouverture.
                onOpenAutoFocus={() => {
                    setTab("email")
                    setValues(current ?? EMPTY)
                    setIsSaving(false)
                }}
                className="w-biblio-dialog max-w-5xl"
            >
                <DialogHeader>
                    <DialogTitle>{ui.editFormatsTitle}</DialogTitle>
                    {/* Rendu conditionnel avec && : n'affiche la question que si qr existe
                        (dialog bien ouvert en mode "edit-format" avec une Q&R valide) */}
                    {qr && <p className="text-xs text-muted-foreground pt-1 line-clamp-1">{tQuestion(qr, lang)}</p>}
                </DialogHeader>

                <div className="flex flex-col gap-3 py-1">
                    {/* Onglets de canal */}
                    <div className="flex gap-1.5 border-b border-border pb-3">
                        {/* .map() transforme le tableau FORMAT_CHANNELS (ex: "email",
                            "instagram", "whatsapp") en un bouton d'onglet par canal.
                            key={key} est l'identifiant unique exigé par React pour une
                            liste d'éléments rendus. */}
                        {FORMAT_CHANNELS.map((key) => (
                            <button key={key} type="button" onClick={() => setTab(key)}
                                // cn(...) fusionne les classes CSS ; le ternaire choisit les
                                // classes "onglet actif" ou "onglet inactif" selon le canal courant.
                                className={cn(
                                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                                    tab === key
                                        ? "bg-muted text-foreground shadow-sm border border-border"
                                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                                )}
                            >
                                {/* MaskIcon + bg-current : même technique que FormatPanel.tsx pour ce
                                    même jeu d'icônes, afin que la couleur suive systématiquement
                                    l'état actif/inactif de l'onglet (text-foreground / text-muted-foreground)
                                    au lieu d'être figée à la couleur du SVG source comme le ferait un <img>. */}
                                <MaskIcon src={iconPath(key)} className="w-6 h-6 bg-current" />
                                {FORMAT_LABELS[key]}
                            </button>
                        ))}
                    </div>

                    {/* Conseil de style pour ce canal */}
                    <p className="text-xs text-muted-foreground italic">{ui.formatHints[tab]}</p>

                    {/* Grille FR | EN */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor={`format-fr-${tab}`} className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{ui.sectionFr}</label>
                            {/* key force la recréation du textarea au changement d'onglet */}
                            <Textarea key={`${tab}-fr`} id={`format-fr-${tab}`}
                                value={values[tab]}
                                onChange={(e) => setFr(e.target.value)}
                                rows={15}
                                placeholder={`${FORMAT_LABELS[tab]}…`}
                                className="resize-none"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor={`format-en-${tab}`} className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{ui.sectionEn}</label>
                            <Textarea key={`${tab}-en`} id={`format-en-${tab}`}
                                value={values[`${tab}En` as keyof FormatMap] as string}
                                onChange={(e) => setEn(e.target.value)}
                                rows={15}
                                placeholder={`${UI_TEXT.en.format} — ${FORMAT_LABELS[tab]}…`}
                                className="resize-none"
                            />
                        </div>
                    </div>
                </div>

                <DialogSaveFooter
                    isSaving={isSaving}
                    saveDisabled={isSaving || allEmpty || hasMismatch}
                    savingLabel={ui.saving}
                    saveLabel={ui.save}
                    cancelLabel={ui.cancel}
                    onSave={handleSubmit}
                />
            </DialogContent>
        </Dialog>
    )
}
