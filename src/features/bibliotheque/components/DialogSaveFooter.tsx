// ── DialogSaveFooter.tsx ──────────────────────────────────────────────────────
// RÔLE : Bandeau de pied de dialog partagé par TOUS les dialogs de la bibliothèque
// qui suivent le motif Annuler + action principale avec spinner pendant l'opération
// (formulaires ET confirmations de suppression).
//
// Avant extraction, QRFormDialog.tsx, FormatEditDialog.tsx, ThematiqueFormDialog.tsx,
// DeleteConfirmDialog (DeleteDialogs.tsx) et DualTextareaDialog (BriefChiffresDialogs.tsx)
// réimplémentaient chacun indépendamment le même bloc DialogFooter/DialogClose/Button
// avec Loader2 — 5 copies du même motif visuel, dont 3 fusionnées une première fois ici,
// puis les 2 dernières (destructives) fusionnées à leur tour via le prop `variant`.
// Un changement du bouton loading (wording, accessibilité...) ne demande plus qu'une
// seule modification pour toute la feature.
//
// variant="destructive" (DeleteConfirmDialog) : seule différence visuelle entre les
// deux familles de dialogs — le bouton principal devient rouge. Le reste du
// comportement (spinner, libellés paramétrables, désactivation) est identique.
//
// cancelDisabled est un prop séparé de saveDisabled/isSaving : ThematiqueFormDialog
// désactive Annuler pendant tout upload en vol (busy), pas seulement pendant isSaving
// (voir son en-tête — fermer trop tôt perdrait le nettoyage d'un fichier fraîchement
// téléversé). Par défaut (non fourni), cancelDisabled retombe sur isSaving.
//
// CE FICHIER EST IMPORTÉ PAR :
//   - QRFormDialog.tsx, FormatEditDialog.tsx, ThematiqueFormDialog.tsx
//   - DeleteDialogs.tsx (DeleteConfirmDialog), BriefChiffresDialogs.tsx (DualTextareaDialog)

import { DialogFooter, DialogClose } from "@/shared/ui/atoms/dialog"
import { Button } from "@/shared/ui/atoms/button"

// Props (les données/callbacks que ce composant reçoit de son parent) : le "?"
// après un nom de prop (ex: cancelDisabled?) signifie que la prop est facultative.
interface DialogSaveFooterProps {
    isSaving: boolean       // true pendant que l'action (save/delete...) est en cours
    saveDisabled: boolean   // true = bouton principal grisé, non cliquable
    savingLabel: string     // texte affiché à côté du spinner pendant isSaving
    saveLabel: string       // texte du bouton principal au repos
    cancelLabel: string     // texte du bouton Annuler
    onSave: () => void      // fonction appelée au clic sur le bouton principal
    cancelDisabled?: boolean
    // "default" (bleu, formulaires) ou "destructive" (rouge, confirmations de suppression)
    variant?: "default" | "destructive"
}

export function DialogSaveFooter({
    isSaving, saveDisabled, savingLabel, saveLabel, cancelLabel, onSave,
    // Valeurs par défaut des props optionnelles : si le parent ne fournit pas
    // cancelDisabled, on retombe sur isSaving ; si pas de variant, "default".
    cancelDisabled = isSaving,
    variant = "default",
}: DialogSaveFooterProps) {
    return (
        <DialogFooter className="gap-2">
            {/* DialogClose (Radix UI) : ferme automatiquement la modale au clic, sans
                avoir à gérer nous-mêmes l'état d'ouverture. asChild fait en sorte que
                Radix applique son comportement de clic directement sur le <Button>
                enfant plutôt que de l'envelopper dans un élément DOM supplémentaire. */}
            <DialogClose asChild disabled={cancelDisabled}>
                <Button variant="outline" size="sm" disabled={cancelDisabled}>{cancelLabel}</Button>
            </DialogClose>
            <Button
                variant={variant}
                size="sm"
                disabled={saveDisabled}
                loading={isSaving}
                onClick={onSave}
            >
                {/* Le spinner vient de la prop `loading` du Button : il porte
                    aussi `aria-busy` et la désactivation, ce que le ternaire
                    manuscrit ne faisait pas. */}
                {isSaving ? savingLabel : saveLabel}
            </Button>
        </DialogFooter>
    )
}
