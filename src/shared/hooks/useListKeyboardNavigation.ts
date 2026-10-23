import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react"

/**
 * Parcours d'une liste d'options au clavier : une option surlignée, les flèches
 * pour la déplacer, Entrée pour la choisir, Échap pour renoncer.
 *
 * Sorti de `SearchSelect` plutôt qu'écrit dedans pour deux raisons. La première
 * est mécanique : ce composant est déjà au-delà du seuil de 400 lignes de
 * `CLAUDE.md`, il ne peut pas grossir. La seconde est que rien ici ne connaît
 * les options, seulement leur NOMBRE — ce qui rend le comportement testable sans
 * monter un popover, et réutilisable par toute liste à venir.
 *
 * Trois points de conception qui ne sont pas évidents :
 *
 *  · **L'index est borné à chaque rendu, pas à chaque frappe.** Dans une liste
 *    filtrée pendant la saisie, `length` diminue sous l'index retenu : sans
 *    borne, Entrée choisirait une option qui n'est plus affichée. C'est un bug
 *    silencieux (aucune erreur, juste la mauvaise catégorie), donc la borne est
 *    dérivée du rendu et non posée par un effet.
 *
 *  · **`-1` veut dire « aucune option surlignée »**, et c'est l'état d'ouverture
 *    voulu : surligner d'office la première option d'une liste de 300 entrées
 *    ferait croire à une présélection. ↓ part alors de la première, ↑ de la
 *    dernière.
 *
 *  · **`onKeyDown` renvoie `true` quand il a traité la touche.** L'appelant
 *    garde ainsi la main sur ce qu'il fait des touches restantes — c'est ce qui
 *    permet à `SearchSelect` de conserver son « Entrée crée l'entrée absente »
 *    quand aucune option ne correspond, sans que les deux règles se disputent la
 *    même touche.
 */

interface UseListKeyboardNavigationOptions {
    /** Nombre d'options actuellement affichées. */
    length: number
    /** Option choisie — appelé seulement si une option est réellement surlignée. */
    onSelect: (index: number) => void
    /** Échap. Absent : la touche n'est pas traitée et remonte à l'appelant. */
    onDismiss?: () => void
}

export interface ListKeyboardNavigation {
    /** Index surligné, ou `-1` si aucun. Toujours dans les bornes de `length`. */
    highlighted: number
    /** Repositionne le surlignage (`-1` pour l'effacer). */
    setHighlighted: (index: number) => void
    /** `id` DOM de l'option, pour `aria-activedescendant`. */
    itemId: (index: number) => string
    /** Valeur d'`aria-activedescendant`, ou `undefined` si rien n'est surligné. */
    activeDescendantId: string | undefined
    /** À passer en `ref` de chaque option, pour la garder visible au défilement. */
    registerItem: (index: number, node: HTMLElement | null) => void
    /** `true` si la touche a été traitée (et son comportement par défaut annulé). */
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => boolean
}

export function useListKeyboardNavigation({
    length,
    onSelect,
    onDismiss,
}: UseListKeyboardNavigationOptions): ListKeyboardNavigation {
    const baseId = useId()
    const [raw, setRaw] = useState(-1)
    const itemsRef = useRef(new Map<number, HTMLElement>())

    // Borne dérivée du rendu : voir le docblock. `length` à 0 efface le
    // surlignage sans qu'aucun effet n'ait à courir derrière.
    const highlighted = length === 0 ? -1 : Math.min(raw, length - 1)

    useEffect(() => {
        if (highlighted < 0) return
        itemsRef.current.get(highlighted)?.scrollIntoView({ block: "nearest" })
    }, [highlighted])

    const itemId = useCallback((index: number) => `${baseId}-option-${index}`, [baseId])

    const registerItem = useCallback((index: number, node: HTMLElement | null) => {
        if (node) itemsRef.current.set(index, node)
        else itemsRef.current.delete(index)
    }, [])

    const onKeyDown = useCallback(
        (event: KeyboardEvent<HTMLElement>): boolean => {
            if (event.key === "Escape") {
                if (!onDismiss) return false
                event.preventDefault()
                onDismiss()
                return true
            }

            if (event.key === "Enter") {
                // Aucune option surlignée : la touche appartient à l'appelant
                // (dans `SearchSelect`, elle crée l'entrée absente).
                if (highlighted < 0) return false
                event.preventDefault()
                onSelect(highlighted)
                return true
            }

            if (length === 0) return false

            if (event.key === "ArrowDown") {
                event.preventDefault()
                // Le bouclage évite le cul-de-sac en fin de liste, où l'on
                // appuierait sur ↓ sans comprendre pourquoi rien ne bouge.
                setRaw(highlighted < 0 ? 0 : (highlighted + 1) % length)
                return true
            }

            if (event.key === "ArrowUp") {
                event.preventDefault()
                setRaw(highlighted <= 0 ? length - 1 : highlighted - 1)
                return true
            }

            if (event.key === "Home") {
                event.preventDefault()
                setRaw(0)
                return true
            }

            if (event.key === "End") {
                event.preventDefault()
                setRaw(length - 1)
                return true
            }

            return false
        },
        [highlighted, length, onDismiss, onSelect],
    )

    return {
        highlighted,
        setHighlighted: setRaw,
        itemId,
        activeDescendantId: highlighted >= 0 ? itemId(highlighted) : undefined,
        registerItem,
        onKeyDown,
    }
}
