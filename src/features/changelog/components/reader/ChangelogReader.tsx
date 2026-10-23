import { useMemo, useState } from "react"
import { ScrollText, SearchX } from "lucide-react"
import { Accordion } from "@/shared/ui/atoms/accordion"
import {
    Dialog,
    DialogContent_2,
    DialogDescription,
    DialogTitle,
} from "@/shared/ui/atoms/dialog"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import { SkeletonCard } from "@/shared/ui/molecules/skeleton-presets"
import { useChangelog } from "../../hooks/data/useChangelog"
import {
    filterVersionByCategory,
    versionMatchesSearch,
} from "../../utils/groupItems"
import { selectPublished } from "../../utils/selectVersions"
import { ChangelogFilters } from "../ChangelogFilters"
import { VersionEntry } from "./VersionEntry"

interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
}

/**
 * Lecteur des nouveautés.
 *
 * Il remplace la timeline dépliable de l'ourlet, qui empilait **cinq
 * ascenseurs imbriqués** : celui de la page, celui du dashboard, celui du
 * dépli, et un par colonne de la grille à deux colonnes. Chacun était
 * défendable seul ; ensemble, on ne savait plus lequel la molette
 * pilotait.
 *
 * Ici il n'y en a qu'un, celui de `DialogContent_2`, et la timeline est
 * en colonne unique. Les filtres restent visibles en tête pendant qu'on
 * parcourt l'historique : c'est ce que la hauteur bornée de l'ourlet
 * rendait impossible.
 */
export function ChangelogReader({ open, onOpenChange }: Props) {
    const { versions, categories, loading } = useChangelog()

    const [search, setSearch] = useState("")
    const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
    // `null` = l'utilisateur n'a encore rien replié ni déplié. Un tableau
    // vide est un choix — celui de tout replier — et doit être respecté.
    const [opened, setOpened] = useState<string[] | null>(null)

    const published = useMemo(() => selectPublished(versions), [versions])

    const shown = useMemo(() => {
        let result = published

        if (search.trim()) {
            result = result.filter((v) => versionMatchesSearch(v, search))
        }

        if (categoryFilter) {
            // On garde la version mais on restreint ses éléments ; une
            // version qui n'a rien dans cette catégorie disparaît.
            result = result
                .map((v) => filterVersionByCategory(v, categoryFilter))
                .filter((v) => v.items.length > 0)
        }

        return result
    }, [published, search, categoryFilter])

    /** Seules les catégories réellement présentes dans le publié. */
    const usedCategories = useMemo(() => {
        const used = new Set<string>()
        for (const version of published) {
            for (const item of version.items) used.add(item.category_id)
        }
        return categories
            .filter((c) => used.has(c.id))
            .sort((a, b) => a.position - b.position)
    }, [published, categories])

    // Une recherche déplie tout : le résultat est à l'intérieur des
    // versions, le laisser replié donnerait l'impression qu'il n'y en a
    // pas. Dérivé plutôt que synchronisé par un effet — il n'y a pas
    // deux états à tenir d'accord, il n'y en a qu'un.
    const expanded = search.trim()
        ? shown.map((v) => v.id)
        : (opened ?? shown.slice(0, 1).map((v) => v.id))

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent_2 className="max-w-3xl gap-0 p-0">
                <div className="sticky top-0 z-10 flex flex-col gap-3 border-b bg-background/95 px-6 py-4 backdrop-blur-sm">
                    <DialogTitle>Nouveautés</DialogTitle>
                    <DialogDescription className="sr-only">
                        Historique des versions déployées.
                    </DialogDescription>

                    {published.length > 0 && (
                        <ChangelogFilters
                            search={search}
                            onSearchChange={setSearch}
                            categories={usedCategories}
                            activeCategoryId={categoryFilter}
                            onCategoryToggle={setCategoryFilter}
                        />
                    )}
                </div>

                <div className="px-6 pb-6">
                    {loading ? (
                        <div className="pt-4">
                            <SkeletonCard label="Chargement des nouveautés" />
                        </div>
                    ) : published.length === 0 ? (
                        <EmptyState
                            icon={ScrollText}
                            title="Aucune nouveauté publiée"
                            description="Les versions déployées apparaîtront ici."
                        />
                    ) : shown.length === 0 ? (
                        <EmptyState
                            size="sm"
                            variant="search"
                            icon={SearchX}
                            title="Aucun résultat"
                            description="Aucune version ne correspond à cette recherche."
                            secondaryAction={{
                                label: "Réinitialiser",
                                onClick: () => {
                                    setSearch("")
                                    setCategoryFilter(null)
                                },
                            }}
                        />
                    ) : (
                        <Accordion
                            type="multiple"
                            value={expanded}
                            onValueChange={setOpened}
                        >
                            {shown.map((version, index) => (
                                <VersionEntry
                                    key={version.id}
                                    version={version}
                                    latest={index === 0}
                                    searchTerm={search}
                                />
                            ))}
                        </Accordion>
                    )}
                </div>
            </DialogContent_2>
        </Dialog>
    )
}
