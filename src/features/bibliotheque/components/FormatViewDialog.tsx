// ── FormatViewDialog.tsx ──────────────────────────────────────────────────────
// RÔLE : Pop-up affichant les réponses formatées par canal (Email / DM / WhatsApp)
// d'une Q&R — même mécanisme de Dialog que les autres pop-up de création/modification
// (QRFormDialog, ThematiqueFormDialog…), plutôt qu'un accordéon inline.
//
// Fonctionnement :
//   - S'ouvre quand dialog.mode === "view-format" (via openViewFormat, appelé
//     depuis FormatToggleButton dans QRCard et QRDetailPanel)
//   - Affiche FormatPanel : onglets de canal, texte du canal actif, bouton Copier
//   - Seule la permission bibliotheque.manage (canManage) détermine si le bouton
//     "Modifier" de FormatPanel est affiché.
//   - Le bouton "Modifier" de FormatPanel appelle openEditFormat(qr), qui remplace
//     ce dialog par FormatEditDialog (un seul dialog ouvert à la fois)
//
// CE FICHIER EST IMPORTÉ PAR :
//   - routes/Bibliotheque.tsx → monté en dehors du layout, toujours disponible
//
// CE FICHIER IMPORTE :
//   - context/BiblioContext.tsx → lit formatReponses, dialog, closeDialog, openEditFormat
//   - components/FormatPanel.tsx → contenu affiché (onglets, texte, copier)

import { useBiblioContext } from "../context/BiblioContext"
import { tQuestion } from "../utils"
import { FormatPanel } from "./FormatPanel"
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/shared/ui/atoms/dialog"

export function FormatViewDialog() {
    const {
        data: { formatReponses },
        perms: { canManage },
        nav: { lang, ui },
        dialogs: { dialog, closeDialog, openEditFormat },
    } = useBiblioContext()

    // "?." (optional chaining) : lit dialog.mode seulement si dialog n'est pas
    // null/undefined, sinon renvoie undefined au lieu de faire planter le code.
    const open = dialog?.mode === "view-format"
    const qr = dialog?.mode === "view-format" ? dialog.qr : null
    const reponses = qr ? formatReponses[qr.id] : undefined

    return (
        // Dialog/DialogContent/DialogHeader/DialogTitle viennent de Radix UI :
        // une pop-up accessible clavier/lecteur d'écran toute prête. "open" contrôle
        // si la pop-up est visible ; onOpenChange est appelé par Radix quand
        // l'utilisateur essaie de la fermer (clic à l'extérieur, touche Échap...).
        <Dialog open={open} onOpenChange={(o) => { if (!o) closeDialog() }}>
            <DialogContent className="w-biblio-dialog max-w-4xl">
                <DialogHeader>
                    <DialogTitle>{ui.format}</DialogTitle>
                    {/* Rendu conditionnel avec `&&` : si qr est "truthy" (pas null),
                        React affiche l'élément à droite du `&&` ; sinon rien du tout. */}
                    {qr && <p className="text-xs text-muted-foreground pt-1 line-clamp-1">{tQuestion(qr, lang)}</p>}
                </DialogHeader>
                {qr && (
                    <FormatPanel
                        reponses={reponses}
                        // Seule la permission bibliotheque.manage masque le bouton
                        // « Modifier » de FormatPanel.
                        readOnly={!canManage}
                        onEdit={() => openEditFormat(qr)}
                    />
                )}
            </DialogContent>
        </Dialog>
    )
}
