import { Search } from "lucide-react"
import { Input } from "@/shared/ui/atoms/input"
import { cn } from "@/shared/lib/utils"
import type { ChangelogCategory } from "../types/changelog.types"

interface Props {
    search: string
    onSearchChange: (value: string) => void
    categories: ChangelogCategory[]
    activeCategoryId: string | null
    onCategoryToggle: (id: string | null) => void
}

/** Barre de recherche et filtres de catégorie. */
export function ChangelogFilters({
    search,
    onSearchChange,
    categories,
    activeCategoryId,
    onCategoryToggle,
}: Props) {
    return (
        <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1 sm:max-w-sm">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    placeholder="Rechercher..."
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="h-9 pl-9"
                    aria-label="Rechercher dans le changelog"
                />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
                {categories.map((category) => {
                    const isActive = activeCategoryId === category.id
                    return (
                        <button
                            key={category.id}
                            type="button"
                            aria-pressed={isActive}
                            onClick={() =>
                                onCategoryToggle(isActive ? null : category.id)
                            }
                            className={cn(
                                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                                isActive
                                    ? "border-border bg-muted text-foreground"
                                    : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                            )}
                        >
                            <span
                                className="size-2 shrink-0 rounded-full"
                                // Couleur de donnée (design system §12.4).
                                style={{ backgroundColor: category.color }}
                            />
                            {category.name}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
