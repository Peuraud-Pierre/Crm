import { Check, Plus } from "lucide-react"
import { cn } from "@/shared/lib/utils"

interface CategorieChipsProps {
    categories: readonly { id: string; name: string }[]
    selected: ReadonlySet<string>
    onToggle: (categoryId: string) => void
}

/**
 * Tout le référentiel en puces, pour qui préfère PARCOURIR plutôt que
 * chercher. Replié par défaut dans le formulaire (`CategorieAjout`) : la
 * recherche et les habituelles couvrent l'essentiel.
 */
export function CategorieChips({ categories, selected, onToggle }: CategorieChipsProps) {
    const triees = [...categories].sort((a, b) => a.name.localeCompare(b.name, "fr"))
    return (
        <div className="flex flex-wrap gap-1.5">
            {triees.map((c) => {
                const on = selected.has(c.id)
                return (
                    <button
                        key={c.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => onToggle(c.id)}
                        className={cn(
                            "inline-flex min-h-9 items-center gap-1 rounded-full border px-3 text-sm transition-colors",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                            on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted",
                        )}
                    >
                        {on ? <Check size={13} /> : <Plus size={13} className="text-muted-foreground" />}
                        {c.name}
                    </button>
                )
            })}
        </div>
    )
}
