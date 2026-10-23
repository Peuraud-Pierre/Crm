import { useMemo } from "react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { cn } from "@/shared/lib/utils"
import {
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/shared/ui/atoms/accordion"
import { Badge } from "@/shared/ui/atoms/badge"
import type { ChangelogVersionWithItems } from "../../types/changelog.types"
import { groupItemsByCategory } from "../../utils/groupItems"
import { CategorySection } from "../CategorySection"

interface Props {
    version: ChangelogVersionWithItems
    /** La plus récente : elle porte la pastille pleine du rail. */
    latest: boolean
    searchTerm: string
}

/**
 * Une version sur la timeline.
 *
 * Un seul composant pour toutes les versions, là où deux coexistaient —
 * `VersionCard` et `LatestVersionCard` — qui ne différaient que par leur
 * en-tête et dupliquaient chacun un état de repli, un effet de
 * dépliage sur recherche et une animation de hauteur.
 *
 * Le repli est confié à l'accordéon Radix : il anime la hauteur en CSS,
 * il gère le clavier et `aria-expanded`, et il rend inutile l'état local
 * que les deux cartes portaient.
 */
export function VersionEntry({ version, latest, searchTerm }: Props) {
    const groups = useMemo(
        () => groupItemsByCategory(version.items),
        [version.items]
    )

    const total = version.items.length
    const plural = total > 1 ? "s" : ""

    return (
        <AccordionItem
            value={version.id}
            className={cn(
                "relative mb-0 rounded-none border-b border-l-0 pl-8",
                latest ? "border-b-border" : "border-b-border/50"
            )}
        >
            {/* Le rail de la timeline : un trait continu, une pastille
                par version. C'est ce qui fait de la liste une chronologie
                plutôt qu'un empilement de cartes. */}
            <span
                aria-hidden="true"
                className="absolute top-0 bottom-0 left-1.5 w-px bg-border"
            />
            <span
                aria-hidden="true"
                className={cn(
                    "absolute top-5 left-0 size-3 rounded-full ring-4 ring-background",
                    latest ? "bg-primary" : "bg-muted-foreground/40"
                )}
            />

            <AccordionTrigger className="gap-3 py-4 hover:no-underline">
                <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-left">
                    <span className="text-base font-semibold text-foreground">
                        v{version.version}
                    </span>

                    {latest && (
                        <Badge variant="success" className="shrink-0">
                            À jour
                        </Badge>
                    )}

                    {version.deployment_date && (
                        <span className="text-sm text-muted-foreground">
                            {format(
                                new Date(version.deployment_date),
                                "d MMMM yyyy",
                                { locale: fr }
                            )}
                        </span>
                    )}

                    <span className="text-xs text-muted-foreground">
                        {total} élément{plural}
                    </span>

                    <CategoryDots groups={groups} />
                </span>
            </AccordionTrigger>

            <AccordionContent className="space-y-4 pb-6">
                {version.summary && (
                    <p className="text-sm leading-relaxed text-muted-foreground">
                        {version.summary}
                    </p>
                )}

                {groups.map(({ category, titleGroups }) => (
                    <CategorySection
                        key={category.id}
                        category={category}
                        titleGroups={titleGroups}
                        searchTerm={searchTerm}
                    />
                ))}
            </AccordionContent>
        </AccordionItem>
    )
}

/** Pastilles de couleur des catégories présentes dans la version. */
function CategoryDots({
    groups,
}: {
    groups: ReturnType<typeof groupItemsByCategory>
}) {
    return (
        <span className="flex shrink-0 gap-1.5">
            {groups.map(({ category }) => (
                <span
                    key={category.id}
                    className="size-2.5 rounded-full ring-1 ring-background"
                    // Couleur de donnée (design system §12.4).
                    style={{ backgroundColor: category.color }}
                    title={category.name}
                />
            ))}
        </span>
    )
}
