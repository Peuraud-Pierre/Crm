// ── SearchResults.tsx ─────────────────────────────────────────────────────────
// RÔLE : Corps de la colonne de gauche (vue recherche) — remplace BiblioSidebar
// quand la barre de recherche contient du texte.
//
// Mise en page :
//   - En-tête (bouton Retour + compteur) + liste scrollable des résultats
//     groupés par thématique
//
// Ne contient PAS le sélecteur de langue / la barre de recherche (BiblioToolbar)
// ni QRDetailPanel (colonne droite) : ceux-ci sont montés par routes/Bibliotheque.tsx,
// qui assemble la vue recherche. BiblioToolbar est monté une seule fois là-bas,
// au-dessus de ce composant et de BiblioSidebar, pour ne jamais démonter l'<input>
// de recherche (et donc perdre le focus) quand on bascule entre les deux vues.
//
// Surlignage : les titres de thématiques et les questions affichent les termes
// cherchés via la fonction highlight() (retourne du JSX avec <mark>).
//
// Interaction :
//   - Clic sur un titre de thématique → handleNavigate (quitte la recherche et navigue).
//     Uniquement si isThematiqueMatch (le libellé de la thématique contient lui-même
//     le terme cherché, voir useSearch.ts) : sinon le groupe n'est affiché que parce
//     que certaines de ses Q&R matchent, et le titre n'est pas un résultat cliquable.
//   - Clic sur une Q&R → setDetailQRId (met à jour le panneau droit sans quitter la recherche)
//   - Bouton "Retour" → clearSearch (vide la recherche et revient à la vue normale)
//
// CE FICHIER EST IMPORTÉ PAR :
//   - routes/Bibliotheque.tsx → affiché quand searchQuery.trim() est truthy
//
// CE FICHIER IMPORTE :
//   - context/BiblioContext.tsx → lit searchGroups, searchQuery, handleNavigate, etc.

import { useBiblioContext } from "../context/BiblioContext"
import { tLabel, tQuestion, highlight } from "../utils"
import { cn } from "@/shared/lib/utils"
import { ChevronRight, Search } from "lucide-react"
import { EmptyState } from "@/shared/ui/molecules/empty-state"

export function SearchResults() {
    const {
        nav: {
            searchGroups,    // résultats calculés par useBiblioPage (groupés par thématique)
            debouncedQuery,  // texte utilisé pour CALCULER searchGroups — voir highlight() ci-dessous
            lang,
            ui,
            handleNavigate,  // quitte la recherche et navigue vers une thématique
            clearSearch,     // ferme la vue recherche sans naviguer (bouton Retour)
            setDetailQRId,   // sélectionne une Q&R pour l'afficher à droite
            detailQRId,      // id de la Q&R actuellement sélectionnée
        },
    } = useBiblioContext()

    // On surligne avec debouncedQuery, PAS searchQuery : searchGroups est lui-même
    // calculé à partir de debouncedQuery (voir useSearch.ts). Utiliser searchQuery
    // (mis à jour à chaque frappe, avant la fin du debounce de 150ms) surlignerait
    // un texte différent de celui qui a produit ces résultats, provoquant un
    // surlignage incohérent le temps du debounce à chaque frappe rapide.
    const query = debouncedQuery.trim()

    // Nombre total de Q&R dans tous les groupes de résultats
    const totalCount = searchGroups.reduce((sum, g) => sum + g.questionsReponses.length, 0)

    return (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {/* En-tête : bouton Retour + compteur de résultats */}
            <div className="px-4 py-3 flex items-center gap-3 shrink-0 border-b border-border">
                <button
                    type="button"
                    onClick={clearSearch}
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                    <ChevronRight className="w-3.5 h-3.5 rotate-180" />
                    {ui.back}
                </button>
                <span className="text-xs text-muted-foreground ml-auto">
                    {ui.results(totalCount)}
                </span>
            </div>

            {/* Corps scrollable */}
            <div className="flex-1 overflow-y-auto px-2 py-3">
                {/* Ternaire (condition ? a : b) : liste vide → message "aucun résultat",
                    sinon la liste des groupes de résultats. */}
                {searchGroups.length === 0 ? (
                    // Aucun résultat trouvé — variant "search" : c'est un filtre
                    // qui ne renvoie rien, pas une bibliothèque vide.
                    <EmptyState
                        size="sm"
                        variant="search"
                        icon={Search}
                        title={ui.noResults(query)}
                    />
                ) : (
                    <div className="space-y-4">
                        {/* .map() transforme chaque groupe de résultats en bloc JSX ; "key"
                            (l'id de la thématique, unique) permet à React de savoir quel
                            bloc correspond à quel groupe si la liste change. */}
                        {searchGroups.map(({ thematique, questionsReponses, isThematiqueMatch }) => (
                            <div key={thematique.id} className="space-y-0.5">
                                {/* Titre de la thématique — cliquable pour y naviguer uniquement si
                                    son libellé contient lui-même le terme cherché (isThematiqueMatch) ;
                                    sinon le groupe n'apparaît que parce que des Q&R matchent, et le
                                    titre n'est qu'un en-tête de regroupement, pas un résultat. */}
                                {isThematiqueMatch ? (
                                    <button
                                        type="button"
                                        onClick={() => handleNavigate(thematique.id)}
                                        className="flex items-center gap-1 px-2 py-1 mb-1 w-full text-left rounded-md hover:bg-muted transition-colors"
                                    >
                                        <span className="text-xs font-semibold uppercase tracking-widest text-brand truncate">
                                            {highlight(tLabel(thematique, lang), query)}
                                        </span>
                                        <ChevronRight className="w-3 h-3 shrink-0 text-brand" />
                                    </button>
                                ) : (
                                    <div className="flex items-center gap-1 px-2 py-1 mb-1 w-full">
                                        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground truncate">
                                            {tLabel(thematique, lang)}
                                        </span>
                                    </div>
                                )}

                                {/* Liste des Q&R correspondantes dans cette thématique — même
                                    principe de .map()/key que ci-dessus, à un niveau imbriqué. */}
                                {questionsReponses.map((qr) => (
                                    <button
                                        key={qr.id}
                                        type="button"
                                        onClick={() => setDetailQRId(qr.id)}
                                        className={cn(
                                            // cn() fusionne la classe de base avec une classe
                                            // conditionnelle (ternaire ? :) selon que cette Q&R
                                            // est celle actuellement sélectionnée ou non.
                                            "w-full text-left px-3 py-2.5 rounded-md text-sm transition-colors",
                                            // Mise en évidence de la Q&R sélectionnée
                                            detailQRId === qr.id
                                                ? "bg-brand/10 border-l-2 border-brand pl-2.5 font-medium text-brand"
                                                : "text-foreground hover:bg-muted"
                                        )}
                                    >
                                        <p className="line-clamp-2">{highlight(tQuestion(qr, lang), query)}</p>
                                    </button>
                                ))}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
