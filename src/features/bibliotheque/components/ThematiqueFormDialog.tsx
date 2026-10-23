// ── ThematiqueFormDialog.tsx ──────────────────────────────────────────────────
// RÔLE : Dialog de création / renommage d'une thématique.
//
// Modes gérés via dialog.mode :
//   - "create-thematique" → formulaire vide, bouton "Créer"
//   - "rename-thematique" → champs pré-remplis avec la thématique existante, bouton "Renommer"
//
// Champs du formulaire :
//   - Nom FR (obligatoire) et Nom EN (obligatoire pour la création)
//   - Image d'illustration (optionnel) : sélectionnée sur l'ordinateur de l'utilisateur,
//     redimensionnée côté client à 200px de hauteur max (ratio conservé, voir
//     ../imageResize.ts) puis téléversée vers Supabase Storage (bucket public
//     'bibliotheque', racine du bucket). Seule la version redimensionnée est
//     envoyée — l'image originale choisie par l'utilisateur n'est jamais stockée.
//   - Icône SVG pour la sidebar (optionnel) : sélectionnée sur l'ordinateur de l'utilisateur,
//     téléversée vers Supabase Storage (bucket public 'bibliotheque', dossier icons/), avec
//     une sanitisation du contenu avant upload (sanitizeSvgText)
//
// Dans les deux cas, le fichier est téléversé dès la sélection (pas au submit) : l'aperçu
// et le chemin stocké dans le formulaire ne changent qu'une fois l'upload confirmé par
// Supabase. Le service gère l'anti-collision (deux thématiques de même nom n'écrasent
// jamais le fichier de l'autre) et le renommage automatique du fichier en Storage quand
// on modifie le nom d'une thématique qui a déjà une image/icône (voir bibliothequeService.ts).
//
// Si l'utilisateur annule le dialog après avoir choisi un fichier (sans valider), le fichier
// déjà téléversé cette session est supprimé du bucket via discardUnsavedUploads() — évite
// les orphelins.
//
// Remplacement d'image en mode renommage : au moment de la SOUMISSION (handleSubmit), si
// l'image a changé, l'ancienne est supprimée du bucket AVANT que la nouvelle (déjà
// téléversée à la sélection, sous un nom temporaire à cause de la collision avec l'ancienne
// encore présente) ne soit renommée pour porter le nom de la thématique — voir
// replaceThematiqueImage() dans bibliothequeMediaService.ts.
//
// Les champs Image et Icône partagent la même mécanique (upload au choix du fichier,
// état de chargement, aperçu, bouton) — factorisée dans runMediaUpload() (logique,
// voir mediaUpload.ts) et MediaPickerField (JSX, voir MediaPickerField.tsx), pour ne
// pas dupliquer deux fois le même bloc try/catch/toast et la même structure de champ.
// Seules les particularités de chaque champ (taille max, validation du type/contenu
// SVG) restent dans handleImageChange/handleIconChange.
//
// aria-describedby={undefined} sur DialogContent : supprime l'avertissement Radix UI
// "Missing Description" car le titre du dialog est suffisamment explicite.
//
// CE FICHIER EST IMPORTÉ PAR :
//   - routes/Bibliotheque.tsx → monté en dehors du layout, visible dans toutes les vues
//
// CE FICHIER IMPORTE :
//   - context/BiblioContext.tsx → lit dialog, closeDialog, handleSaveThematique,
//     uploadThematiqueImage, uploadThematiqueIcon, discardUnsavedThematiqueMedia,
//     resolveThematiqueMediaUrl, ui
//   - ./mediaUpload.ts → runMediaUpload (extrait d'ici, voir son en-tête)
//   - ./MediaPickerField.tsx → champ Image/Icône (extrait d'ici, voir son en-tête)

import { useMemo, useRef, useState } from "react"
import type { ChangeEvent } from "react"
import { useBiblioContext } from "../context/BiblioContext"
import { UI_TEXT } from "../constants"
import { sanitizeSvgText } from "../utils"
import { resizeImageToMaxHeight, sniffImageMime } from "../imageResize"
import { runMediaUpload } from "./mediaUpload"
import { MediaPickerField } from "./MediaPickerField"
import { DialogSaveFooter } from "./DialogSaveFooter"
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/shared/ui/atoms/dialog"
import { Input } from "@/shared/ui/atoms/input"
import { toast } from "sonner"

// Filet de sécurité côté client (échec rapide, avant l'aller-retour réseau) —
// la vraie limite est appliquée par Supabase Storage (file_size_limit sur le
// bucket, voir 20260715130000_bibliotheque_manage_permission.sql). Les icônes
// SVG sont plafonnées plus bas : ce sont de petits fichiers texte, une icône
// de plusieurs Mo est anormale.
const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024 // 8 Mo
const MAX_ICON_SIZE_BYTES = 1 * 1024 * 1024  // 1 Mo

export function ThematiqueFormDialog() {
    const {
        nav: { ui },
        dialogs: { dialog, closeDialog },
        handlers: {
            handleSaveThematique, uploadThematiqueImage, uploadThematiqueIcon,
            discardUnsavedThematiqueMedia, replaceThematiqueImage, resolveThematiqueMediaUrl,
        },
    } = useBiblioContext()

    const open = dialog?.mode === "create-thematique" || dialog?.mode === "rename-thematique"

    // En mode renommage, on récupère la thématique existante pour pré-remplir
    const initial = dialog?.mode === "rename-thematique" ? dialog.thematique : null

    // États locaux — initialisés vides ; onOpenAutoFocus est la seule source d'initialisation
    const [label, setLabel] = useState("")
    const [labelEn, setLabelEn] = useState("")
    const [imageUrl, setImageUrl] = useState("")
    const [iconUrl, setIconUrl] = useState("")

    // true pendant le téléversement du fichier choisi — désactive le champ concerné
    // et le bouton de soumission pour éviter d'enregistrer une URL incomplète
    const [isUploadingImage, setIsUploadingImage] = useState(false)
    const [isUploadingIcon, setIsUploadingIcon] = useState(false)

    // Les <input type="file"> sont masqués ; on les déclenche via ref depuis un bouton stylé.
    // useRef donne un accès direct à l'élément <input> du DOM (voir MediaPickerField.tsx),
    // pour appeler .click() dessus par programme sans passer par le state React.
    const imageInputRef = useRef<HTMLInputElement>(null)
    const iconInputRef = useRef<HTMLInputElement>(null)

    // Protège contre la double soumission : désactive le bouton pendant l'opération
    const [isSaving, setIsSaving] = useState(false)

    const busy = isSaving || isUploadingImage || isUploadingIcon

    // Historique de TOUS les chemins Storage téléversés pendant cette session du
    // dialog (pas seulement le dernier) : si l'utilisateur sélectionne une image,
    // puis change d'avis et en sélectionne une autre avant de valider, les DEUX
    // uploads ont réellement eu lieu côté Storage, mais seul le second finit dans
    // imageUrl/iconUrl. Sans cet historique, le premier fichier ne serait jamais
    // nettoyé (ni à l'annulation, ni même après une sauvegarde réussie, puisque
    // seule la valeur finale est référencée en base) et resterait orphelin dans
    // le bucket de façon permanente. useRef (pas useState) : pur historique
    // interne, ne doit jamais provoquer de re-render. Contrairement à useState,
    // modifier .current d'une ref ne redessine PAS le composant — c'est voulu ici
    // car cet historique n'a aucun impact sur ce qui est affiché à l'écran.
    const uploadedImagePathsRef = useRef<string[]>([])
    const uploadedIconPathsRef = useRef<string[]>([])

    // Supprime du bucket tous les chemins téléversés cette session SAUF ceux à
    // conserver (keepImage/keepIcon — la valeur qui vient d'être sauvegardée en
    // base, ou qui reste dans le formulaire après un échec de sauvegarde pour
    // permettre une nouvelle tentative sans re-upload). Réinitialise ensuite
    // l'historique pour ne garder que ce qui a été conservé.
    async function cleanupAbandonedUploads(keepImage: string, keepIcon: string) {
        const abandonedImages = uploadedImagePathsRef.current.filter((p) => p !== keepImage)
        const abandonedIcons = uploadedIconPathsRef.current.filter((p) => p !== keepIcon)
        uploadedImagePathsRef.current = keepImage ? [keepImage] : []
        uploadedIconPathsRef.current = keepIcon ? [keepIcon] : []
        // discardUnsavedThematiqueMedia(image, icon) supprime les deux chemins en
        // un seul appel Storage : on l'appelle par paire pour couvrir le cas où
        // plusieurs images ET plusieurs icônes ont été abandonnées à la fois.
        const pairs: [string, string][] = []
        const maxLen = Math.max(abandonedImages.length, abandonedIcons.length)
        for (let i = 0; i < maxLen; i++) pairs.push([abandonedImages[i] ?? "", abandonedIcons[i] ?? ""])
        for (const [img, icon] of pairs) {
            await discardUnsavedThematiqueMedia(img, icon).catch((err) =>
                console.error("[ThematiqueFormDialog] cleanupAbandonedUploads:", err)
            )
        }
    }

    // useMemo mémorise (met en cache) le résultat d'un calcul et ne le refait
    // que si une de ses dépendances (le tableau entre crochets) change — ici
    // uniquement quand imageUrl change, pas à chaque frappe dans les champs nom
    // (qui re-rendent tout le dialog sans que l'image ait bougé).
    const resolvedImagePreview = useMemo(
        () => resolveThematiqueMediaUrl(imageUrl),
        [imageUrl, resolveThematiqueMediaUrl]
    )
    const resolvedIconPreview = useMemo(
        () => resolveThematiqueMediaUrl(iconUrl),
        [iconUrl, resolveThematiqueMediaUrl]
    )

    // Sélection d'une image : upload immédiat vers Supabase Storage, l'aperçu et
    // le chemin du formulaire ne changent qu'une fois l'upload confirmé.
    async function handleImageChange(e: ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        e.target.value = "" // permet de resélectionner le même fichier plus tard
        if (!file || !label.trim()) return
        await runMediaUpload({
            file,
            label: label.trim(),
            excludeId: initial?.id,
            maxSizeBytes: MAX_IMAGE_SIZE_BYTES,
            upload: uploadThematiqueImage,
            setUploading: setIsUploadingImage,
            // On enregistre le chemin dans l'historique EN PLUS de le mettre dans
            // le formulaire, pour pouvoir le nettoyer plus tard s'il est abandonné.
            setValue: (v) => { uploadedImagePathsRef.current.push(v); setImageUrl(v) },
            errTooLarge: ui.errFileTooLarge,
            errUpload: ui.errUploadImage,
            // Le type est lu dans les octets du fichier : l'attribut accept et le
            // type annoncé par le navigateur sont tous deux choisis par celui qui
            // téléverse, donc ni l'un ni l'autre ne prouve quoi que ce soit.
            validateContent: async (f) =>
                (await sniffImageMime(f)) ? null : ui.errInvalidImage,
            // Ré-encodage canvas : c'est cette version, faite de pixels et de
            // rien d'autre, qui part vers Storage — jamais le fichier d'origine.
            transformFile: resizeImageToMaxHeight,
        })
    }

    // Sélection d'une icône : vérification du type SVG, puis nettoyage du
    // contenu (voir sanitizeSvgText) — c'est le SVG assaini qui est téléversé.
    async function handleIconChange(e: ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        e.target.value = ""
        if (!file || !label.trim()) return
        if (!file.name.toLowerCase().endsWith(".svg") && file.type !== "image/svg+xml") {
            toast.error(ui.errInvalidIcon)
            return
        }
        await runMediaUpload({
            file,
            label: label.trim(),
            excludeId: initial?.id,
            maxSizeBytes: MAX_ICON_SIZE_BYTES,
            upload: uploadThematiqueIcon,
            setUploading: setIsUploadingIcon,
            setValue: (v) => { uploadedIconPathsRef.current.push(v); setIconUrl(v) },
            errTooLarge: ui.errFileTooLarge,
            errUpload: ui.errUploadIcon,
            validateContent: async (f) =>
                sanitizeSvgText(await f.text()) === null ? ui.errUnsafeIcon : null,
            // Le fichier envoyé est le résultat du nettoyage, pas celui choisi :
            // valider puis téléverser l'original laisserait passer tout ce que
            // la validation n'a pas su voir.
            transformFile: async (f) => {
                const clean = sanitizeSvgText(await f.text())
                // Non atteignable : validateContent a déjà rejeté ce cas. La
                // garde est là parce que rien n'impose que les deux restent
                // appelées dans cet ordre.
                if (clean === null) throw new Error("SVG rejeté par la sanitisation")
                return new File([clean], f.name, { type: "image/svg+xml" })
            },
        })
    }

    async function handleSubmit() {
        if (!label.trim() || busy) return
        setIsSaving(true)
        try {
            let finalImageUrl = imageUrl.trim()
            const finalIconUrl = iconUrl.trim()

            // L'utilisateur a remplacé l'image existante par un nouveau fichier
            // pendant cette session (mode renommage) : on supprime D'ABORD
            // l'ancienne image du bucket, PUIS on renomme la nouvelle (déjà
            // téléversée sous un nom temporaire à cause de la collision avec
            // l'ancienne, encore présente à ce moment-là — voir
            // uploadWithCollisionRetry) pour qu'elle porte le nom de la
            // thématique. Ignoré en création (initial est null, rien à
            // remplacer) et si l'image n'a pas changé.
            if (initial?.imageUrl && finalImageUrl && finalImageUrl !== initial.imageUrl) {
                try {
                    const renamedImageUrl = await replaceThematiqueImage(
                        initial.imageUrl, finalImageUrl, label.trim(), initial.id
                    )
                    // Le fichier vient d'être déplacé (Storage.move) de finalImageUrl
                    // vers renamedImageUrl : on met à jour l'historique de la session
                    // en conséquence, sinon cleanupAbandonedUploads ci-dessous
                    // tenterait de supprimer un chemin qui n'existe déjà plus.
                    uploadedImagePathsRef.current = uploadedImagePathsRef.current.map(
                        (p) => p === finalImageUrl ? renamedImageUrl : p
                    )
                    finalImageUrl = renamedImageUrl
                    setImageUrl(finalImageUrl)
                } catch (err) {
                    console.error("[ThematiqueFormDialog] replaceThematiqueImage:", err)
                    toast.error(ui.errUploadImage)
                    return
                }
            }

            await handleSaveThematique(label.trim(), labelEn.trim(), finalImageUrl, finalIconUrl)
            // Que la sauvegarde ait réussi ou échoué, on nettoie tout de suite les
            // uploads intermédiaires abandonnés (ex: image choisie puis remplacée
            // avant validation) en conservant uniquement la valeur qui vient
            // d'être soumise — elle est soit désormais référencée en base (succès),
            // soit toujours affichée dans le formulaire pour une nouvelle tentative
            // (échec). Dans les deux cas, ce n'est PLUS un upload "abandonné".
            await cleanupAbandonedUploads(finalImageUrl, finalIconUrl)
        } finally {
            setIsSaving(false)
        }
    }

    // Appelé uniquement sur une fermeture déclenchée par l'utilisateur (Annuler,
    // Échap, clic hors du dialog) — jamais après une sauvegarde réussie : dans ce
    // cas closeDialog() est appelé directement par handleSaveThematique via un
    // changement programmatique de `open`, pas par une interaction Radix détectée
    // ici. Supprime du bucket TOUS les fichiers téléversés cette session (aucun
    // n'a été sauvegardé, donc rien à conserver) — voir cleanupAbandonedUploads.
    function discardUnsavedUploads() {
        cleanupAbandonedUploads("", "").catch((err) =>
            console.error("[ThematiqueFormDialog] discardUnsavedUploads:", err)
        )
    }

    return (
        <Dialog open={open} onOpenChange={(o) => {
            // !busy (pas seulement !isSaving) : si un upload est encore en cours,
            // son chemin n'est pas encore dans uploadedImagePathsRef/uploadedIconPathsRef
            // (poussé seulement quand l'upload se termine, dans runMediaUpload).
            // Fermer maintenant nettoierait un historique qui ne contient pas encore
            // ce fichier, qui deviendrait alors orphelin dès que l'upload se termine
            // après coup. On bloque donc la fermeture tant qu'un upload est en vol,
            // comme le bouton Annuler et le bouton de soumission le font déjà.
            if (!o && !busy) {
                discardUnsavedUploads()
                closeDialog()
            }
        }}>
            <DialogContent
                aria-describedby={undefined}
                onOpenAutoFocus={() => {
                    setLabel(initial?.label ?? "")
                    setLabelEn(initial?.labelEn ?? "")
                    setImageUrl(initial?.imageUrl ?? "")
                    setIconUrl(initial?.iconUrl ?? "")
                    setIsSaving(false)
                    setIsUploadingImage(false)
                    setIsUploadingIcon(false)
                    // Nouvelle session : aucun upload n'a encore eu lieu, on repart
                    // d'un historique vide (les valeurs initiales pré-existantes ne
                    // sont pas des uploads de cette session, donc ne doivent jamais
                    // être candidates au nettoyage).
                    uploadedImagePathsRef.current = []
                    uploadedIconPathsRef.current = []
                }}
                className="max-w-md"
            >
                <DialogHeader>
                    <DialogTitle>{initial ? ui.renameTopic : ui.newTopicTitle}</DialogTitle>
                </DialogHeader>

                <div className="flex flex-col gap-4 py-2">
                    {/* Champ nom français */}
                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="topic-label-fr" className="text-sm font-medium">{ui.topicNameLabel} — {ui.sectionFr}</label>
                        <Input
                            id="topic-label-fr"
                            placeholder={ui.topicNamePlaceholder}
                            value={label}
                            onChange={(e) => setLabel(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") handleSubmit() }}
                        />
                    </div>
                    {/* Champ nom anglais */}
                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="topic-label-en" className="text-sm font-medium">{UI_TEXT.en.topicNameLabel} — {ui.sectionEn}</label>
                        <Input
                            id="topic-label-en"
                            placeholder={UI_TEXT.en.topicNamePlaceholder}
                            value={labelEn}
                            onChange={(e) => setLabelEn(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") handleSubmit() }}
                        />
                    </div>
                    {/* Champ image d'illustration (H2) */}
                    <MediaPickerField
                        id="topic-image"
                        label={ui.topicImageLabel}
                        previewUrl={resolvedImagePreview}
                        previewClassName="w-14 h-14 rounded-md object-cover border border-border"
                        inputRef={imageInputRef}
                        accept="image/png,image/jpeg,image/webp"
                        uploading={isUploadingImage}
                        disabled={isSaving || isUploadingImage || !label.trim()}
                        chooseLabel={ui.topicImageChoose}
                        uploadingLabel={ui.uploading}
                        hint={!label.trim() ? ui.topicMediaNameRequired : undefined}
                        onChange={handleImageChange}
                    />
                    {/* Champ icône SVG (sidebar) — même principe, restreint aux fichiers .svg */}
                    <MediaPickerField
                        id="topic-icon"
                        label={ui.topicIconLabel}
                        previewUrl={resolvedIconPreview}
                        previewClassName="w-6 h-6 border border-border rounded bg-card"
                        inputRef={iconInputRef}
                        accept=".svg,image/svg+xml"
                        uploading={isUploadingIcon}
                        disabled={isSaving || isUploadingIcon || !label.trim()}
                        chooseLabel={ui.topicIconChoose}
                        uploadingLabel={ui.uploading}
                        onChange={handleIconChange}
                    />
                </div>

                {/* cancelDisabled=busy (pas seulement isSaving) : un upload en vol ne doit
                    pas pouvoir être court-circuité par Annuler avant que son chemin soit
                    historisé pour le nettoyage — voir cleanupAbandonedUploads plus haut.
                    saveDisabled suit la même règle, plus les noms FR/EN obligatoires. */}
                <DialogSaveFooter
                    isSaving={isSaving}
                    cancelDisabled={busy}
                    saveDisabled={busy || !label.trim() || !labelEn.trim()}
                    savingLabel={ui.saving}
                    saveLabel={initial ? ui.rename : ui.create}
                    cancelLabel={ui.cancel}
                    onSave={handleSubmit}
                />
            </DialogContent>
        </Dialog>
    )
}
