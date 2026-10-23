// ── BriefPanel.tsx ────────────────────────────────────────────────────────────
// RÔLE : Panneau d'accueil — affiché à droite quand aucune thématique n'est sélectionnée.
//
// Affiche deux sections du brief global :
//   1. Brief "Règles d'or" (texte libre, éditable via BriefEditDialog)
//   2. Chiffres de référence (texte libre, éditable via ChiffresEditDialog)
//
// Le contenu est affiché dans la langue active (lang). La propriété sélectionnée
// dépend de lang : brief.brief (fr) ou brief.briefEn (en), idem pour chiffres.
//
// Si un champ est vide, un texte en italique invite l'utilisateur à le remplir.
// Les icônes sont affichées via CSS mask (WebkitMaskImage) sur un fond couleur brand,
// ce qui permet de les coloriser sans SVG dupliqué.
//
// CE FICHIER EST IMPORTÉ PAR :
//   - routes/Bibliotheque.tsx → rendu à droite quand activeId est vide (état 4)
//
// CE FICHIER IMPORTE :
//   - context/BiblioContext.tsx → lit brief, lang, ui, openEditBrief, openEditChiffres

import { useBiblioContext } from "../context/BiblioContext"
import { MaskIcon } from "./MaskIcon"
import { Button } from "@/shared/ui/atoms/button"
import { Pencil } from "lucide-react"

export function BriefPanel() {
    // useBiblioContext() donne accès à l'état partagé de la feature Bibliothèque
    // (pas besoin de props ici) ; la déstructuration ci-dessous extrait juste les
    // valeurs dont ce composant a besoin.
    const { data: { brief }, perms: { canManage }, nav: { lang, ui }, dialogs: { openEditBrief, openEditChiffres } } = useBiblioContext()

    // Sélection de la valeur à afficher selon la langue active
    const briefText = lang === "fr" ? brief.brief : brief.briefEn
    const chiffresText = lang === "fr" ? brief.chiffres : brief.chiffresEn

    return (
        <div className="flex-1 min-w-0 flex flex-col gap-6 overflow-y-auto">
            {/* ── Brief ── */}
            <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">

                    <h2 className="flex items-center gap-2 min-w-0 text-xs sm:text-sm font-semibold uppercase tracking-wide sm:tracking-widest text-brand">
                        <MaskIcon src="/bibliotheque/icons/briefgeneral.svg" className="w-6 h-6 sm:w-8 sm:h-8 shrink-0 bg-brand" />
                        {ui.briefTitle}
                    </h2>
                    {canManage && (
                        <Button
                            variant="ghost" size="icon"
                            aria-label={ui.editBriefTitle}
                            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-accent-foreground"
                            onClick={openEditBrief}
                        >
                            <Pencil className="w-3.5 h-3.5" />
                        </Button>
                    )}
                </div>
                <p className="text-sm text-foreground/80 whitespace-pre-wrap break-words leading-relaxed">
                    {/* Rendu conditionnel avec || : si briefText est une chaîne vide (donc
                        "falsy"), JavaScript prend la valeur de droite — ici le message
                        d'invitation en italique. */}
                    {briefText || (
                        <span className="text-muted-foreground italic">{ui.noBrief}</span>
                    )}
                </p>
            </div>

            {/* ── Chiffres de référence ── */}
            <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                    <h2 className="flex items-center gap-2 min-w-0 text-xs sm:text-sm font-semibold uppercase tracking-wide sm:tracking-widest text-brand">
                        <MaskIcon src="/bibliotheque/icons/chiffrescles.svg" className="w-6 h-6 sm:w-8 sm:h-8 shrink-0 bg-brand" />
                        {ui.chiffresTitle}
                    </h2>
                    {canManage && (
                        <Button
                            variant="ghost" size="icon"
                            aria-label={ui.editChiffresTitle}
                            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-accent-foreground"
                            onClick={openEditChiffres}
                        >
                            <Pencil className="w-3.5 h-3.5" />
                        </Button>
                    )}
                </div>
                <p className="text-sm text-foreground/80 whitespace-pre-wrap break-words leading-relaxed">
                    {/* Même principe de rendu conditionnel avec || que pour briefText plus haut */}
                    {chiffresText || (
                        <span className="text-muted-foreground italic">{ui.noChiffres}</span>
                    )}
                </p>
            </div>
        </div>
    )
}
