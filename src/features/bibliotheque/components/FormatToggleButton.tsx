// ── FormatToggleButton.tsx ────────────────────────────────────────────────────
// RÔLE : Bouton "Formater" qui ouvre le pop-up FormatViewDialog.
//
// Identique dans QRCard.tsx et QRDetailPanel.tsx (mêmes icône + libellé, tous
// deux ouvrent FormatViewDialog pour la même Q&R). Extrait ici pour ne maintenir
// qu'une seule fois ce bloc plutôt que deux copies qui pourraient diverger
// silencieusement au fil des évolutions.
//
// CE FICHIER EST IMPORTÉ PAR :
//   - components/QRCard.tsx        → ouvre FormatViewDialog depuis la colonne principale
//   - components/QRDetailPanel.tsx → ouvre FormatViewDialog depuis la vue recherche

import { MaskIcon } from "./MaskIcon"
import { Button } from "@/shared/ui/atoms/button"

// Props (les données/fonctions passées au composant par son parent) : ici deux
// props, "onClick" (une fonction sans argument qui ne renvoie rien) et "label"
// (le texte affiché, déjà traduit dans la langue active par le composant appelant).
export function FormatToggleButton({ onClick, label, className }: {
    onClick: () => void  // ouvre FormatViewDialog pour la Q&R courante
    label: string        // texte du bouton (ui.format, déjà traduit par l'appelant)
    className?: string   // classes additionnelles (ex. positionnement dans la barre d'actions du parent)
}) {
    return (
        <Button
            variant="ghost"
            size="sm"
            className={`h-9 sm:h-7 px-2 text-xs shrink-0 bg-brand/10 text-brand hover:bg-muted hover:text-foreground${className ? ` ${className}` : ""}`}
            onClick={onClick}
        >
            <MaskIcon src="/bibliotheque/icons/formatsreponses.svg" className="w-4 h-4 sm:w-6 sm:h-6 shrink-0 bg-brand" />
            <span className="ml-1">{label}</span>
        </Button>
    )
}
