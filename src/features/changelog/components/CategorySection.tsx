import { getCategoryIcon } from "../utils/categoryIcon"
import { countDescriptions, type TitleGroup } from "../utils/groupItems"
import type { ChangelogCategory } from "../types/changelog.types"
import { HighlightText } from "./HighlightText"

interface Props {
    category: ChangelogCategory
    titleGroups: TitleGroup[]
    searchTerm: string
}

/**
 * Un bloc « catégorie » dans le corps d'une version.
 *
 * Les couleurs viennent de la base (`changelog_categories.color`), pas des
 * tokens du thème : c'est une couleur de **donnée**, cas explicitement
 * prévu par le design system (§12.4). D'où les styles en ligne.
 */
export function CategorySection({ category, titleGroups, searchTerm }: Props) {
    const Icon = getCategoryIcon(category.icon)

    return (
        <div
            className="rounded-lg border-l-4 py-3 pl-3 pr-2 sm:pl-4 sm:pr-3"
            style={{
                borderColor: category.color,
                backgroundColor: `${category.color}08`,
            }}
        >
            <div className="mb-3 flex items-center gap-2.5">
                {Icon ? (
                    <Icon
                        className="size-5"
                        style={{ color: category.color }}
                    />
                ) : (
                    <div
                        className="size-3 rounded-full"
                        style={{ backgroundColor: category.color }}
                    />
                )}
                <h4 className="break-words text-sm font-bold text-foreground sm:text-base">
                    {category.name}
                </h4>
                <span
                    className="rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{
                        backgroundColor: `${category.color}20`,
                        color: category.color,
                    }}
                >
                    {countDescriptions(titleGroups)}
                </span>
            </div>

            <div className="ml-1">
                {titleGroups.map((group, index) => (
                    <div
                        key={group.title}
                        className={`-mx-3 rounded-md px-3 py-3 transition-colors ${
                            index % 2 === 0
                                ? "bg-transparent hover:bg-muted/40"
                                : "bg-muted/60 hover:bg-muted/80"
                        }`}
                    >
                        <p className="mb-1.5 break-words text-sm font-semibold text-foreground sm:text-base">
                            <HighlightText
                                text={group.title}
                                search={searchTerm}
                            />
                        </p>

                        <ul className="space-y-0.5 pl-3">
                                {group.descriptions.map(
                                    (description, i) =>
                                        description && (
                                            <li
                                                // eslint-disable-next-line react-x/no-array-index-key -- les descriptions peuvent se répéter ou être nulles ; l'indice les distingue au sein d'un titre
                                                key={`${group.title}-${i}`}
                                                className="flex gap-1.5 whitespace-pre-line break-words text-xs text-muted-foreground"
                                            >
                                                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground/40" />
                                                <HighlightText
                                                    text={description}
                                                    search={searchTerm}
                                                />
                                            </li>
                                        )
                                )}
                        </ul>
                    </div>
                ))}
            </div>
        </div>
    )
}
