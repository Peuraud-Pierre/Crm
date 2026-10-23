// ── BiblioSidebar.tsx ─────────────────────────────────────────────────────────
// RÔLE : Corps de la colonne de gauche (vue normale) — affiche la liste des thématiques.
//
// Contenu :
//   - Un bouton "Nouvelle thématique", juste au-dessus du titre "Thématiques"
//   - Un bouton "Brief général" toujours visible (désélectionne toute thématique)
//   - Un ThematiqueItem par thématique (avec badge de comptage et actions survol)
//
// Ne contient PAS le sélecteur de langue / la barre de recherche (BiblioToolbar) :
// celle-ci est montée une seule fois par routes/Bibliotheque.tsx, au-dessus de ce
// composant et de SearchResults, pour ne jamais démonter l'<input> de recherche
// (et donc perdre le focus) quand on bascule entre vue normale et vue recherche.
//
// Aucune prop : toutes les données et actions viennent du contexte BiblioContext.
//
// CE FICHIER EST IMPORTÉ PAR :
//   - routes/Bibliotheque.tsx → rendu dans la vue complète (état 4), vue normale
//
// CE FICHIER IMPORTE :
//   - context/BiblioContext.tsx → lit thematiques, activeId, countByThematique
//   - components/ThematiqueItem.tsx → composant pur pour chaque ligne de la liste

import { useCallback, useMemo } from "react"
import { useBiblioContext } from "../context/BiblioContext"
import { ThematiqueItem } from "./ThematiqueItem"
import { MaskIcon } from "./MaskIcon"
import { tLabel } from "../utils"
import { cn } from "@/shared/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/atoms/card"
import { Button } from "@/shared/ui/atoms/button"
import { Plus } from "lucide-react"

export function BiblioSidebar() {
    const {
        data: { thematiques, countByThematique },  // dictionnaire { [id]: nombre de Q&R }
        perms: { canManage },
        nav: { activeId, setActiveId, lang, ui },
        dialogs: { openRenameThematique, openDeleteThematique, openCreateThematique },
        handlers: { resolveThematiqueMediaUrl },
    } = useBiblioContext()

    // useMemo(calcul, dépendances) : ne recalcule "calcul" que si une des
    // dépendances a changé. Ici, résout l'URL d'icône de chaque thématique une
    // seule fois par changement de `thematiques`, plutôt qu'à chaque render
    // (ex: sélection d'une autre thématique, frappe dans la recherche...) dans
    // la boucle de rendu ci-dessous.
    const iconUrlById = useMemo(
        () => Object.fromEntries(thematiques.map((t) => [t.id, resolveThematiqueMediaUrl(t.iconUrl)])),
        [thematiques, resolveThematiqueMediaUrl]
    )

    // handleRename/handleDelete : callbacks à référence STABLE (tant que
    // `thematiques` ne change pas) transmis à chaque ThematiqueItem — voir
    // l'en-tête de ThematiqueItem.tsx. Sans ça, une fonction fléchée différente
    // serait recréée pour chaque ligne à chaque rendu, et memo() sur
    // ThematiqueItem n'aurait plus aucun effet.
    const handleRename = useCallback((id: string) => {
        const t = thematiques.find((th) => th.id === id)
        if (t) openRenameThematique(t)
    }, [thematiques, openRenameThematique])

    const handleDelete = useCallback((id: string) => {
        const t = thematiques.find((th) => th.id === id)
        if (t) openDeleteThematique(t)
    }, [thematiques, openDeleteThematique])

    return (
        <Card className="flex-1 flex flex-col min-h-0">
            <CardHeader className="pb-2 pt-4 px-4 gap-3">
                {canManage && (
                    <Button
                        size="sm"
                        className="gap-2"
                        onClick={openCreateThematique}
                    >
                        <Plus className="w-4 h-4" /> {ui.newTopic}
                    </Button>
                )}
                <CardTitle className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                    {ui.topics}
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-1 px-3 pb-3 overflow-y-auto">
                {/* Brief général — entrée de navigation toujours visible, active quand aucune thématique n'est sélectionnée */}
                <button
                    type="button"
                    aria-current={!activeId || undefined}
                    onClick={() => setActiveId("")}
                    // cn(...) fusionne plusieurs classes CSS en une seule chaîne (en gérant
                    // les doublons/conflits Tailwind). Le deuxième argument est un ternaire :
                    // classes "actif" si aucune thématique n'est sélectionnée, sinon classes
                    // "inactif".
                    className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
                        !activeId
                            ? "bg-brand/10 text-brand border-l-2 border-brand font-medium pl-2.5"
                            : "text-muted-foreground hover:bg-muted"
                    )}
                >
                    <MaskIcon src="/bibliotheque/icons/briefgeneral.svg" className="w-5 h-5 bg-foreground" />
                    {ui.briefNav}
                </button>
                {/* .map() transforme le tableau `thematiques` en une liste de composants
                    ThematiqueItem — un bouton par thématique. key={t.id} est l'identifiant
                    unique que React exige pour chaque élément d'une liste rendue. */}
                {thematiques.map((t) => (
                    <ThematiqueItem
                        key={t.id}
                        id={t.id}
                        label={tLabel(t, lang)}
                        iconUrl={iconUrlById[t.id]}
                        count={countByThematique[t.id] ?? 0}
                        active={activeId === t.id}
                        onClick={setActiveId}
                        onRename={canManage ? handleRename : undefined}
                        onDelete={canManage ? handleDelete : undefined}
                        renameLabel={ui.renameTopic}
                        deleteLabel={ui.deleteTopic}
                    />
                ))}
            </CardContent>
        </Card>
    )
}
