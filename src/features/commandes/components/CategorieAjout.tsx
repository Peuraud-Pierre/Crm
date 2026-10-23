import { useId, useRef, useState } from "react"
import { ChevronDown, CornerDownLeft, History, Plus, Search, X } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import { cn } from "@/shared/lib/utils"
import { chercherCategories, type Habituelle } from "@/features/commandes/utils/commandeSuggestions"
import { formatKg } from "@/features/commandes/utils/commandeAvancement"
import type { CommandeBoutique } from "@/features/commandes/types/commande.types"
import { CategorieChips } from "./CategorieChips"

interface CategorieAjoutProps {
    categories: readonly { id: string; name: string }[]
    /** Catégories déjà dans la commande. */
    selected: ReadonlySet<string>
    habituelles: readonly Habituelle[]
    /** Dernière commande de la boutique, proposée tant que la commande est vide. */
    derniere: { commande: CommandeBoutique; lignes: readonly { category_id: string; kg: number }[] } | null
    /** Ajoute une ligne, pré-remplie de `kg` s'il est connu. */
    onAdd: (categoryId: string, kg?: number) => void
    onRemove: (categoryId: string) => void
    onReprendre: (lignes: readonly { category_id: string; kg: number }[]) => void
}

/**
 * Ajout de catégories à une commande, sans faire défiler tout le référentiel :
 *
 *   1. une RECHERCHE (on tape « jea », Entrée ajoute la première) ;
 *   2. les HABITUELLES de la boutique, pré-remplies de leur quantité
 *      ordinaire ;
 *   3. « reprendre la dernière commande » quand on part de zéro ;
 *   4. tout le référentiel, REPLIÉ, pour qui veut parcourir.
 *
 * La recherche reste au focus après un ajout : on enchaîne les catégories
 * au clavier comme au doigt.
 */
export function CategorieAjout({ categories, selected, habituelles, derniere, onAdd, onRemove, onReprendre }: CategorieAjoutProps) {
    const [query, setQuery] = useState("")
    const [actif, setActif] = useState(0)
    const [parcourir, setParcourir] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)
    const listId = useId()

    const resultats = chercherCategories(categories, query, selected)
    const suggestions = habituelles.filter((h) => !selected.has(h.category_id))
    const reprendre = selected.size === 0 ? derniere : null

    const ajouter = (categoryId: string, kg?: number) => {
        onAdd(categoryId, kg)
        setQuery("")
        setActif(0)
        inputRef.current?.focus()
    }

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "ArrowDown" && resultats.length) {
            e.preventDefault()
            setActif((actif + 1) % resultats.length)
        } else if (e.key === "ArrowUp" && resultats.length) {
            e.preventDefault()
            setActif((actif - 1 + resultats.length) % resultats.length)
        } else if (e.key === "Enter") {
            // Jamais de soumission du formulaire depuis la recherche.
            e.preventDefault()
            const choisie = resultats[actif]
            if (choisie) ajouter(choisie.id, habituelles.find((h) => h.category_id === choisie.id)?.kgHabituel)
        } else if (e.key === "Escape" && query) {
            e.preventDefault()
            setQuery("")
        }
    }

    return (
        <div className="flex flex-col gap-3">
            <div className="relative">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                    ref={inputRef}
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value)
                        setActif(0)
                    }}
                    onKeyDown={onKeyDown}
                    placeholder={`Ajouter une catégorie (${categories.length})`}
                    aria-label="Chercher une catégorie à ajouter"
                    role="combobox"
                    aria-expanded={resultats.length > 0}
                    aria-controls={listId}
                    aria-activedescendant={resultats[actif] ? `${listId}-${resultats[actif].id}` : undefined}
                    autoComplete="off"
                    className="h-12 pl-9 pr-9 text-base"
                />
                {query && (
                    <button type="button" onClick={() => setQuery("")} aria-label="Effacer la recherche"
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:text-foreground">
                        <X size={16} />
                    </button>
                )}
            </div>

            {query.trim() ? (
                resultats.length === 0 ? (
                    <p className="px-1 text-sm text-muted-foreground">
                        Aucune catégorie libre ne correspond à « {query.trim()} ».
                    </p>
                ) : (
                    <ul id={listId} role="listbox" aria-label="Catégories trouvées" className="flex flex-col overflow-hidden rounded-xl border border-border">
                        {resultats.map((c, i) => (
                            <li key={c.id} id={`${listId}-${c.id}`} role="option" aria-selected={i === actif}>
                                <button
                                    type="button"
                                    onMouseEnter={() => setActif(i)}
                                    onClick={() => ajouter(c.id, habituelles.find((h) => h.category_id === c.id)?.kgHabituel)}
                                    className={cn("flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm", i === actif ? "bg-muted" : "hover:bg-muted/60")}
                                >
                                    <Plus size={14} className="text-muted-foreground" />
                                    <span className="flex-1 font-medium">{c.name}</span>
                                    {i === actif && <CornerDownLeft size={14} className="hidden text-muted-foreground sm:block" aria-hidden />}
                                </button>
                            </li>
                        ))}
                    </ul>
                )
            ) : (
                <>
                    {reprendre && (
                        <Button type="button" variant="outline" className="h-auto justify-start gap-2 py-2.5 text-left" onClick={() => onReprendre(reprendre.lignes)}>
                            <History size={16} className="shrink-0" />
                            <span className="flex min-w-0 flex-col">
                                <span className="font-medium">Reprendre la dernière commande</span>
                                <span className="truncate text-xs font-normal text-muted-foreground">
                                    {reprendre.commande.code} · {reprendre.lignes.length} catégorie{reprendre.lignes.length > 1 ? "s" : ""} · {formatKg(reprendre.lignes.reduce((s, l) => s + l.kg, 0))}
                                </span>
                            </span>
                        </Button>
                    )}
                    {suggestions.length > 0 && (
                        <div className="flex flex-col gap-1.5">
                            <span className="text-xs font-medium text-muted-foreground">Vos habituelles</span>
                            <div className="flex flex-wrap gap-1.5">
                                {suggestions.map((h) => (
                                    <button
                                        key={h.category_id}
                                        type="button"
                                        onClick={() => ajouter(h.category_id, h.kgHabituel)}
                                        className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                                    >
                                        <Plus size={13} className="text-muted-foreground" />
                                        <span className="font-medium">{h.nom}</span>
                                        <span className="text-xs tabular-nums text-muted-foreground">{h.kgHabituel} kg</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}

            <div>
                <button type="button" onClick={() => setParcourir(!parcourir)} aria-expanded={parcourir}
                    className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
                    <ChevronDown size={14} className={cn("transition-transform", parcourir && "rotate-180")} />
                    {parcourir ? "Masquer la liste" : `Parcourir toutes les catégories (${categories.length})`}
                </button>
                {parcourir && (
                    <div className="mt-2 max-h-60 overflow-y-auto rounded-xl border border-border p-2">
                        <CategorieChips categories={categories} selected={selected}
                            onToggle={(id) => (selected.has(id) ? onRemove(id) : onAdd(id, habituelles.find((h) => h.category_id === id)?.kgHabituel))} />
                    </div>
                )}
            </div>
        </div>
    )
}
