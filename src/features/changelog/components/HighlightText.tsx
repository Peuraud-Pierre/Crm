/** Caractères à neutraliser pour injecter un terme libre dans une regex. */
const REGEX_SPECIALS = /[.*+?^${}()|[\]\\]/g

/**
 * Surligne les occurrences d'un terme de recherche dans un texte.
 *
 * L'implémentation précédente construisait une expression régulière avec
 * le drapeau `g`, puis appelait `regex.test(part)` sur chaque fragment.
 * `test()` sur une regex globale est **avec état** : elle avance
 * `lastIndex` à chaque appel et repart de cette position au suivant. Une
 * occurrence sur deux n'était donc pas surlignée, de façon apparemment
 * arbitraire. Ici, `split` fournit déjà l'information — les fragments
 * d'indice impair sont les captures — et aucun `test()` n'est nécessaire.
 */
export function HighlightText({
    text,
    search,
}: {
    text: string
    search: string
}) {
    const needle = search.trim()
    if (!needle) return <span>{text}</span>

    const escaped = needle.replace(REGEX_SPECIALS, "\\$&")
    const parts = text.split(new RegExp(`(${escaped})`, "gi"))

    return (
        <span>
            {parts.map((part, index) =>
                // `split` avec un groupe capturant intercale les captures
                // aux indices impairs : c'est la définition du découpage,
                // pas une heuristique.
                index % 2 === 1 ? (
                    <mark
                        // eslint-disable-next-line react-x/no-array-index-key -- les fragments peuvent être identiques ; l'indice les distingue
                        key={index}
                        className="rounded-sm bg-primary/20 px-0.5 text-foreground"
                    >
                        {part}
                    </mark>
                ) : (
                    // eslint-disable-next-line react-x/no-array-index-key -- idem
                    <span key={index}>{part}</span>
                )
            )}
        </span>
    )
}
