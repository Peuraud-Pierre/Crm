// ── QRDetailPanel.tsx ─────────────────────────────────────────────────────────
// RÔLE : Panneau de détail de la vue recherche (colonne droite).
//
// Affiche la Q&R sélectionnée dans SearchResults avec :
//   - Un fil d'Ariane cliquable (nom de la thématique → "Voir la thématique")
//   - La question et la réponse avec les termes cherchés surlignés (fonction highlight)
//   - Des boutons Modifier / Supprimer (réservés à bibliotheque.manage, comme
//     dans QRCard) et un bouton "Formater" qui ouvre FormatViewDialog
//
// Quand aucune Q&R n'est sélectionnée (detailQR = null), affiche un message d'invite.
//
// La fonction highlight() (importée de utils.tsx) retourne des éléments JSX avec
// des <mark> autour des occurrences trouvées — c'est pourquoi utils.tsx est en .tsx.
//
// CE FICHIER EST IMPORTÉ PAR :
//   - components/SearchResults.tsx → rendu dans la colonne droite de la vue recherche
//
// CE FICHIER IMPORTE :
//   - context/BiblioContext.tsx → lit canManage, detailQR, detailThematique,
//     debouncedQuery, handleNavigate, openViewFormat, openEditQR, openDeleteQR
//   - components/FormatToggleButton.tsx → bouton qui ouvre le pop-up FormatViewDialog

import { useBiblioContext } from "../context/BiblioContext"
import { tLabel, tQuestion, tReponse, highlight } from "../utils"
import { MaskIcon } from "./MaskIcon"
import { FormatToggleButton } from "./FormatToggleButton"
import { Card, CardContent } from "@/shared/ui/atoms/card"
import { Button } from "@/shared/ui/atoms/button"
import { ChevronRight, Pencil, Trash2 } from "lucide-react"

export function QRDetailPanel() {
    const {
        perms: { canManage },
        nav: { lang, ui, debouncedQuery, handleNavigate, detailQR, detailThematique },
        dialogs: { openViewFormat, openEditQR, openDeleteQR },
    } = useBiblioContext()

    // debouncedQuery, pas searchQuery : detailQR provient de searchGroups, lui-même
    // calculé à partir de debouncedQuery (voir SearchResults.tsx pour le détail).
    const query = debouncedQuery.trim()

    // Sortie anticipée ("early return") : si aucune Q&R n'est sélectionnée, on
    // arrête ici et on affiche un message d'invite au lieu du reste du composant.
    if (!detailQR) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-muted-foreground text-center leading-relaxed">
                    {ui.selectQuestionLine1}<br />{ui.selectQuestionLine2}
                </p>
            </div>
        )
    }

    return (
        <div className="flex-1 min-w-0 flex flex-col gap-4 overflow-y-auto px-6 py-5">
            {/* Fil d'Ariane : nom de la thématique + lien "Voir la thématique" */}
            <div className="flex items-center gap-1.5">
                {/* Ternaire (condition ? a : b) : affiche le nom de la thématique s'il y
                    en a une, sinon une chaîne vide. */}
                <span className="text-xs font-medium text-muted-foreground">
                    {detailThematique ? tLabel(detailThematique, lang) : ""}
                </span>
                <button type="button"
                    onClick={() => detailThematique && handleNavigate(detailThematique.id)}
                    className="shrink-0 flex items-center gap-0.5 text-xs text-brand hover:underline"
                >
                    {ui.viewTopic} <ChevronRight className="w-3 h-3" />
                </button>
            </div>

            <Card>
                <CardContent className="p-4 space-y-3">
                    {/* Question et réponse avec les termes cherchés surlignés */}
                    <div className="flex items-center gap-2 min-w-0">
                        <MaskIcon src="/bibliotheque/icons/question.svg" className="w-6 h-6 sm:w-8 sm:h-8 shrink-0 bg-foreground" />
                        <p className="font-semibold text-foreground">{highlight(tQuestion(detailQR, lang), query)}</p>
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{highlight(tReponse(detailQR, lang), query)}</p>

                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1 border-t border-border">
                        {/* Modifier / Supprimer réservés à bibliotheque.manage, comme dans QRCard. */}
                        {canManage && (
                            <>
                                <Button variant="ghost" size="sm"
                                    className="h-9 sm:h-7 px-2 text-xs shrink-0 text-muted-foreground hover:text-accent-foreground"
                                    onClick={() => openEditQR(detailQR)}
                                >
                                    <Pencil className="w-3.5 h-3.5" /><span className="ml-1">{ui.edit}</span>
                                </Button>
                                <Button variant="ghost" size="sm"
                                    className="h-9 sm:h-7 px-2 text-xs shrink-0 text-muted-foreground hover:text-accent-foreground"
                                    onClick={() => openDeleteQR(detailQR)}
                                >
                                    <Trash2 className="w-3.5 h-3.5" /><span className="ml-1">{ui.delete}</span>
                                </Button>
                            </>
                        )}

                        <FormatToggleButton onClick={() => openViewFormat(detailQR)} label={ui.format} className="ml-auto" />
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
