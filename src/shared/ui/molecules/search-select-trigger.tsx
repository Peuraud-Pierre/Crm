import type { ComponentPropsWithRef, KeyboardEvent } from "react"
import { ChevronDown, Search, X } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import { cn } from "@/shared/lib/utils"

/**
 * Les deux déclencheurs de `SearchSelect` : le champ de saisie qui cherche
 * lui-même (`variant="input"`, formulaires) et le bouton compact qui ouvre une
 * liste (`variant="button"`, barres de filtres).
 *
 * Extraits parce que `search-select.tsx` était déjà au-delà du seuil de 400
 * lignes de `CLAUDE.md` avant d'accueillir le parcours clavier. Le découpage
 * suit la responsabilité : ici l'apparence et les événements du déclencheur,
 * là-bas l'état de la liste et l'arbitrage des touches. Rendu repris à
 * l'identique.
 *
 * Les deux composants RELAIENT les props qu'ils reçoivent jusqu'au nœud DOM.
 * C'est une obligation, pas une commodité : Radix les monte en `asChild`, donc
 * il leur passe son `onClick`, son `ref` et ses attributs d'état. Un composant
 * intermédiaire qui les avale laisse un déclencheur qui n'ouvre plus rien, sans
 * la moindre erreur — c'est exactement ce qui s'est produit à l'extraction.
 */

interface SearchSelectInputFieldProps {
    placeholder: string
    /** Classe de hauteur héritée (`h-8` ou `h-10`). */
    heightClass: string
    showValidation: boolean
    /** Le texte saisi correspond-il exactement à l'option retenue ? */
    isInputValid: boolean
    inputText: string
    isOpen: boolean
    onFocus: () => void
    onTextChange: (value: string) => void
    onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
    activeDescendantId: string | undefined
    onClear: () => void
}

type InputFieldProps = SearchSelectInputFieldProps & ComponentPropsWithRef<"div">

export function SearchSelectInputField({
    placeholder,
    heightClass,
    showValidation,
    isInputValid,
    inputText,
    isOpen,
    onFocus,
    onTextChange,
    onKeyDown,
    activeDescendantId,
    onClear,
    ...anchorProps
}: InputFieldProps) {
    return (
        <div {...anchorProps} className="relative group w-full">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
                <Search
                    size={14}
                    className={cn("transition-colors", isOpen ? "text-primary" : "text-muted-foreground")}
                />
            </div>
            <Input
                placeholder={placeholder}
                className={cn(
                    "pl-9 pr-24 transition-[box-shadow,border-color] focus-visible:ring-2 focus-visible:ring-offset-0",
                    heightClass,
                    "bg-background border-border text-foreground placeholder:text-muted-foreground",
                    showValidation && inputText && !isInputValid
                        ? "border-destructive focus-visible:ring-destructive/20"
                        : showValidation && isInputValid
                        ? "border-success focus-visible:ring-success/20"
                        : "focus-visible:ring-ring/20 ring-offset-background"
                )}
                value={inputText}
                onFocus={onFocus}
                onChange={e => onTextChange(e.target.value)}
                onKeyDown={onKeyDown}
                aria-activedescendant={activeDescendantId}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {inputText.length > 0 && (
                    <Button
                        type="button"
                        onClick={onClear}
                        className="p-1 rounded-full bg-transparent hover:bg-transparent dark:hover:bg-transparent"
                    >
                        <X size={14} className="text-muted-foreground" />
                    </Button>
                )}
                <div className="w-px h-3.5 mx-0.5 bg-border" />
                <ChevronDown
                    size={14}
                    className={cn(
                        "transition-transform duration-slow text-muted-foreground",
                        isOpen ? "rotate-180" : ""
                    )}
                />
            </div>
        </div>
    )
}

interface SearchSelectButtonTriggerProps {
    /** Libellé de l'option retenue, ou `null` pour afficher le placeholder. */
    selectedLabel: string | null
    placeholder: string
    heightClass: string
    textClass: string
    isOpen: boolean
    onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void
}

type ButtonTriggerProps = SearchSelectButtonTriggerProps & ComponentPropsWithRef<"button">

export function SearchSelectButtonTrigger({
    selectedLabel,
    placeholder,
    heightClass,
    textClass,
    isOpen,
    onKeyDown,
    ...triggerProps
}: ButtonTriggerProps) {
    return (
        <Button
            {...triggerProps}
            type="button"
            variant="outline"
            className={cn(
                "w-full justify-between font-normal",
                heightClass, textClass,
                "bg-background border-border"
            )}
            onKeyDown={onKeyDown}
            // Un nom de référentiel long ne tient pas dans un déclencheur
            // compact : au survol, il se relit sans rouvrir la liste.
            title={selectedLabel ?? undefined}
        >
            <span className={cn("truncate", selectedLabel === null && "text-muted-foreground")}>
                {selectedLabel ?? placeholder}
            </span>
            <ChevronDown
                size={12}
                className={cn(
                    "shrink-0 ml-2 transition-transform duration-base text-muted-foreground",
                    isOpen ? "rotate-180" : ""
                )}
            />
        </Button>
    )
}
