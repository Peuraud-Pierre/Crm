import type { LucideIcon } from "lucide-react"
import { AlertCircle, Check, Plus } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { cn } from "@/shared/lib/utils"

/**
 * Corps de la liste de `SearchSelect` : les options, et l'offre de création.
 *
 * Extrait du composant parce que `search-select.tsx` avait dépassé le seuil de
 * 400 lignes de `CLAUDE.md` avant même d'accueillir la navigation clavier. Le
 * rendu est repris à l'identique ; la seule addition est le surlignage clavier,
 * porté par `data-highlighted` et non par une classe conditionnelle, pour qu'il
 * emprunte exactement l'habillage de `hover:` — une liste qui se parcourt au
 * clavier et à la souris ne doit pas avoir deux apparences.
 */

export interface SearchSelectOption {
    value: string
    label: string
    icon?: LucideIcon
    subLabel?: string
}

interface SearchSelectItemsProps {
    options: SearchSelectOption[]
    /** Valeur retenue, pour la coche. */
    value: string
    onSelect: (option: SearchSelectOption) => void
    /** Classe de taille de texte héritée du parent (`text-xs` ou `text-sm`). */
    textClass: string
    emptyMessage: string
    /** Index surligné au clavier, `-1` si aucun. */
    highlighted: number
    itemId: (index: number) => string
    registerItem: (index: number, node: HTMLElement | null) => void
}

export function SearchSelectItems({
    options,
    value,
    onSelect,
    textClass,
    emptyMessage,
    highlighted,
    itemId,
    registerItem,
}: SearchSelectItemsProps) {
    return (
        <div
            className="max-h-64 overflow-y-auto p-1.5 touch-pan-y bg-muted/50"
            // Le popover vit dans un board défilant : sans ça, la molette
            // fait défiler la page derrière au lieu de la liste.
            onWheel={e => e.stopPropagation()}
            onTouchMove={e => e.stopPropagation()}
        >
            {options.length > 0 ? (
                <div className="flex flex-col gap-0.5">
                    {options.map((opt, index) => {
                        const Icon = opt.icon
                        return (
                            <Button
                                key={opt.value}
                                id={itemId(index)}
                                ref={node => registerItem(index, node)}
                                type="button"
                                variant="ghost"
                                data-highlighted={index === highlighted || undefined}
                                className={cn(
                                    "w-full justify-start px-2.5 h-9 group/item transition-colors",
                                    "text-muted-foreground hover:bg-muted hover:text-foreground",
                                    "data-[highlighted]:bg-muted data-[highlighted]:text-foreground",
                                )}
                                onClick={() => onSelect(opt)}
                                // Le libellé se tronque dans un déclencheur
                                // étroit : au survol, il se lit en entier sans
                                // avoir à choisir pour le découvrir.
                                title={opt.subLabel ? `${opt.label} — ${opt.subLabel}` : opt.label}
                            >
                                <div className="flex items-center gap-2.5 w-full overflow-hidden">
                                    {Icon && (
                                        <div className="p-1 rounded transition-colors shrink-0 bg-muted text-muted-foreground group-hover/item:bg-card group-data-[highlighted]/item:bg-card">
                                            <Icon size={12} />
                                        </div>
                                    )}
                                    <div className="flex flex-col min-w-0 flex-1">
                                        <span className={cn(
                                            "truncate font-medium transition-colors",
                                            textClass,
                                            "text-muted-foreground group-hover/item:text-foreground group-data-[highlighted]/item:text-foreground"
                                        )}>
                                            {opt.label}
                                        </span>
                                        {opt.subLabel && (
                                            <span className="text-3xs text-muted-foreground truncate leading-tight">
                                                {opt.subLabel}
                                            </span>
                                        )}
                                    </div>
                                    {value === opt.value && (
                                        <Check size={14} className="text-primary ml-auto shrink-0" />
                                    )}
                                </div>
                            </Button>
                        )
                    })}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                    <AlertCircle size={18} className="mb-2 text-muted-foreground" />
                    <p className="text-sm font-medium text-muted-foreground">
                        {emptyMessage}
                    </p>
                </div>
            )}
        </div>
    )
}

/**
 * Deux libellés désignent-ils la même chose ?
 *
 * Sert uniquement à décider si l'on propose « créer ». Ni la casse ni les
 * espaces surnuméraires ne distinguent deux entrées d'un référentiel : sans la
 * réduction des espaces internes, « blouson  jean » était offert à la création
 * alors que « blouson jean » existait déjà.
 *
 * Les accents, eux, distinguent — ce sont des mots différents. Un quasi-doublon
 * accentué est donc encore offert ici, et c'est la couche service qui le refuse
 * avec un message explicite (la forme stockée fait foi, voir
 * `features/stock/utils/categoryNaming.ts`).
 */
export function sameLabel(a: string, b: string): boolean {
    const key = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase()
    return key(a) === key(b)
}

interface SearchSelectCreateProps {
    /** Texte cherché, qui deviendra le nom de l'entrée créée. */
    query: string
    /** Intitulé au-dessus du texte à créer. */
    label: string
    textClass: string
    onCreate: () => void
}

export function SearchSelectCreate({ query, label, textClass, onCreate }: SearchSelectCreateProps) {
    return (
        <div className="border-t border-border p-1.5">
            {/* Deux lignes plutôt qu'une phrase : dans un déclencheur
                étroit (une ligne dépliée), « Créer la catégorie « … » »
                était tronqué avant même le texte saisi. L'intitulé est
                court et fixe, le texte à créer a toute la largeur et
                se lit en entier au survol. */}
            <Button
                type="button"
                variant="ghost"
                className="h-auto w-full items-center justify-start gap-2 px-2.5 py-1.5 text-left hover:bg-primary/5"
                onClick={onCreate}
                title={query}
                aria-label={`${label} « ${query} »`}
            >
                <span className="flex size-6 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
                    <Plus size={13} aria-hidden />
                </span>
                <span className="flex min-w-0 flex-col">
                    <span className="text-3xs uppercase tracking-wider text-muted-foreground">
                        {label}
                    </span>
                    <span className={cn("truncate font-medium text-primary", textClass)}>{query}</span>
                </span>
            </Button>
        </div>
    )
}
