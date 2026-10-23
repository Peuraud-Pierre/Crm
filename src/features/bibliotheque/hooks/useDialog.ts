// ── hooks/useDialog.ts ────────────────────────────────────────────────────────
// RÔLE : Gère l'état "quel dialog est ouvert, et avec quelles données".
//
// Un "dialog" est une fenêtre modale qui s'affiche par-dessus la page
// (ex : le formulaire de création d'une thématique, la confirmation de suppression…).
// Ce hook est une mini machine à états : à tout moment, soit aucun dialog n'est
// ouvert (null), soit UN dialog est ouvert dans un mode précis avec ses données.
//
// Il ne sait rien de la base de données ni des textes d'interface — il se
// contente de mémoriser QUEL dialog est ouvert. C'est useBiblioPage.ts qui
// appelle ces fonctions et relie les dialogs aux vraies actions CRUD.
//
// CE FICHIER EST IMPORTÉ PAR :
//   - hooks/useBiblioPage.ts → utilise toutes les fonctions d'ouverture/fermeture

import { useState, useCallback } from "react"
import { useLiveRef } from "@/shared/hooks/useLiveRef"
import type { QR, Thematique } from "../types"

// Type discriminé : chaque mode de dialog a sa propre forme.
// Le champ "mode" est le discriminant — TypeScript s'en sert pour savoir
// quels autres champs sont disponibles dans chaque branche.
export type DialogState =
    | null                                                    // aucun dialog ouvert
    | { mode: "create-qr" }                                   // créer une nouvelle Q&R
    | { mode: "edit-qr"; qr: QR }                             // modifier une Q&R existante
    | { mode: "delete-qr"; qr: QR }                           // confirmer la suppression d'une Q&R
    | { mode: "create-thematique" }                           // créer une nouvelle thématique
    | { mode: "rename-thematique"; thematique: Thematique }   // renommer une thématique
    | { mode: "delete-thematique"; thematique: Thematique }   // confirmer la suppression d'une thématique
    | { mode: "edit-brief" }                                  // modifier le brief global
    | { mode: "edit-chiffres" }                               // modifier les chiffres de référence
    | { mode: "edit-format"; qr: QR }                         // modifier les formats d'une Q&R
    | { mode: "view-format"; qr: QR }                         // afficher les formats d'une Q&R dans un pop-up

export function useDialog() {
    // "dialog" est null si aucun dialog n'est ouvert, sinon c'est un objet
    // avec un champ "mode" qui précise lequel est ouvert.
    const [dialog, setDialog] = useState<DialogState>(null)

    // dialogRef est une "référence" vers la valeur courante de dialog.
    // On s'en sert dans useBiblioPage.ts pour lire dialog.mode à l'intérieur
    // de callbacks useCallback sans les re-créer à chaque changement de dialog.
    // (Pattern "event handler ref" en React — voir @/shared/hooks/useLiveRef.ts)
    const dialogRef = useLiveRef(dialog)

    // useCallback garantit que ces fonctions ne sont pas recréées à chaque render,
    // ce qui évite des re-renders inutiles dans les composants qui les reçoivent.
    const closeDialog      = useCallback(() => setDialog(null), [])
    const openCreateQR     = useCallback(() => setDialog({ mode: "create-qr" }), [])
    const openEditQR       = useCallback((qr: QR) => setDialog({ mode: "edit-qr", qr }), [])
    const openDeleteQR     = useCallback((qr: QR) => setDialog({ mode: "delete-qr", qr }), [])
    const openEditFormat   = useCallback((qr: QR) => setDialog({ mode: "edit-format", qr }), [])
    const openViewFormat   = useCallback((qr: QR) => setDialog({ mode: "view-format", qr }), [])
    const openCreateThematique = useCallback(() => setDialog({ mode: "create-thematique" }), [])
    const openRenameThematique = useCallback((t: Thematique) => setDialog({ mode: "rename-thematique", thematique: t }), [])
    const openDeleteThematique = useCallback((t: Thematique) => setDialog({ mode: "delete-thematique", thematique: t }), [])
    const openEditBrief    = useCallback(() => setDialog({ mode: "edit-brief" }), [])
    const openEditChiffres = useCallback(() => setDialog({ mode: "edit-chiffres" }), [])

    // On retourne toutes les valeurs et fonctions utiles pour les consommateurs
    return {
        dialog, dialogRef, closeDialog,
        openCreateQR, openEditQR, openDeleteQR, openEditFormat, openViewFormat,
        openCreateThematique, openRenameThematique, openDeleteThematique,
        openEditBrief, openEditChiffres,
    }
}
