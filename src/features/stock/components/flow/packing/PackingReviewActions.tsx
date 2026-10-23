import { ListChecks, Undo2 } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"

interface PackingReviewActionsProps {
    /** Libellés que l'annulation ramènerait. Vide : rien à annuler. */
    undoLabels: string[]
    onUndo?: () => void
    /** Aucun libellé n'a encore le focus, et il reste du travail. */
    canResume: boolean
    onResume: () => void
}

/**
 * Les deux gestes de la barre de strate qui ne concernent pas un libellé en
 * particulier : revenir en arrière, et reprendre le fil.
 *
 * Extraits de `PackingReviewPanel` pour le garder sous le seuil de 400 lignes
 * de `CLAUDE.md`.
 *
 * L'annulation NOMME le libellé qu'elle ramènerait : « Annuler » seul
 * obligerait à se souvenir de ce qu'on annule, ce qui est précisément ce
 * qu'on n'a pas en tête après quarante décisions.
 *
 * « Reprendre le classement » existe parce que 140 décisions ne se prennent pas
 * en une séance : au retour, le filtre revient bien sur « à classer » mais le
 * focus repart de nulle part. C'est un BOUTON et non un autofocus — le prendre
 * au montage volerait le focus au piège de focus de la sheet, qui vient de
 * s'ouvrir (voir le docblock de `usePackingReviewFocus`).
 */
export function PackingReviewActions({
    undoLabels,
    onUndo,
    canResume,
    onResume,
}: PackingReviewActionsProps) {
    return (
        <>
            {canResume && (
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5"
                    onClick={onResume}
                >
                    <ListChecks size={13} aria-hidden />
                    Reprendre le classement
                </Button>
            )}

            {onUndo && undoLabels.length > 0 && (
                <Button type="button" size="sm" variant="ghost" className="h-8 gap-1.5" onClick={onUndo}>
                    <Undo2 size={13} aria-hidden />
                    <span className="max-w-60 truncate">
                        Annuler «&nbsp;{undoLabels[0]}&nbsp;»
                        {undoLabels.length > 1 && ` +${undoLabels.length - 1}`}
                    </span>
                </Button>
            )}
        </>
    )
}
