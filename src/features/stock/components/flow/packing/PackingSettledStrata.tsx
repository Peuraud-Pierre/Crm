import type { ReactNode } from "react"
import { Bot, PartyPopper } from "lucide-react"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import type { PackingGroup } from "@/features/stock/types/packing-list.types"

interface PackingSettledStrataProps {
    model: PackingGroup[]
    reviewed: PackingGroup[]
    dictionary: PackingGroup[]
    /** Les acquis sont-ils affichés ? Le filtre « à classer » les masque. */
    showSettled: boolean
    /** Vue « Acquis » : les reconnus y sont dépliés au lieu d'être repliés. */
    reviewedOnly: boolean
    renderCard: (group: PackingGroup, index: number) => ReactNode
}

/**
 * Ce qui est acquis : classé par le modèle, tranché dans cette session, ou
 * reconnu par le tableau de correspondance.
 *
 * Extraite de `PackingReviewPanel` pour le ramener sous le seuil de 400 lignes
 * de `CLAUDE.md`. Le découpage suit la charge d'attention qu'un libellé
 * réclame, qui est l'organisation même de cet écran : ce fichier ne contient
 * que ce qui ne demande PLUS de décision.
 *
 * Les groupes classés par le modèle restent dépliés, et c'est la seule règle à
 * ne pas défaire ici : c'est la seule strate où une erreur passerait sans
 * qu'un humain ait choisi.
 */
export function PackingSettledStrata({
    model,
    reviewed,
    dictionary,
    showSettled,
    reviewedOnly,
    renderCard,
}: PackingSettledStrataProps) {
    const nothingSettled =
        reviewedOnly && reviewed.length === 0 && dictionary.length === 0 && model.length === 0

    return (
        <>
            {model.length > 0 && (
                <>
                    <div className="flex items-start gap-2 pt-1">
                        <Bot size={13} className="mt-px shrink-0 text-primary" aria-hidden />
                        <p className="text-2xs text-muted-foreground">
                            <span className="font-semibold uppercase tracking-wider">
                                Classés automatiquement ({model.length})
                            </span>{" "}
                            — appris de vos décisions précédentes. Rien à faire s'ils sont justes ; une
                            correction sert d'exemple pour les prochains conteneurs.
                        </p>
                    </div>
                    {model.map(renderCard)}
                </>
            )}

            {showSettled && reviewed.length > 0 && (
                <>
                    <p className="pt-1 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Classés ({reviewed.length})
                    </p>
                    {reviewed.map(renderCard)}
                </>
            )}

            {reviewedOnly && dictionary.length > 0 && (
                <>
                    <p className="pt-1 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Reconnus ({dictionary.length})
                    </p>
                    {dictionary.map(renderCard)}
                </>
            )}

            {nothingSettled && (
                <EmptyState
                    size="sm"
                    icon={PartyPopper}
                    title="Aucun libellé classé pour l'instant"
                    className="rounded-xl border border-dashed border-border"
                />
            )}
        </>
    )
}
