import { useEffect, useRef, useState, type KeyboardEvent } from "react"
import type { PackingGroup } from "@/features/stock/types/packing-list.types"

/**
 * Navigation clavier et dépliage des cartes de la revue d'une packing list.
 *
 * Sorti de `PackingReviewPanel` pour lui laisser la place du mouvement d'entrée
 * et de sortie des strates : le panneau approchait le seuil de 400 lignes, et
 * cet état-là ne parle ni de strates ni de filtres.
 *
 * Le point délicat est le focus DOM. Il ne suit `focusedKey` qu'après un GESTE
 * de l'utilisateur (`moveDomFocusRef`) : le prendre au montage volerait le focus
 * au piège de focus de la sheet, qui vient tout juste de s'ouvrir.
 */

interface UsePackingReviewFocusOptions {
    /**
     * Cartes réellement rendues, dans l'ordre du DOM. Une carte d'une strate
     * repliée n'y figure pas, sinon le focus partirait dans le vide.
     */
    navigable: PackingGroup[]
    /** Entrée sur une carte focalisée. */
    onEnter: (group: PackingGroup) => void
    /**
     * Espace sur une carte focalisée. Sert à ouvrir la liste des catégories même
     * quand une proposition existe — le cas « la proposition est fausse », que
     * Entrée ne couvre pas puisqu'elle la retiendrait.
     */
    onSpace?: (group: PackingGroup) => void
    /**
     * Chiffre 1-5 sur une carte focalisée : attribue la Nᵉ catégorie récemment
     * utilisée. Le geste qu'on supprime n'est pas « choisir parmi 300
     * catégories », c'est « redire pour la huitième fois celle qu'on vient de
     * dire ».
     */
    onDigit?: (group: PackingGroup, index: number) => void
}

export interface PackingReviewFocus {
    focusedKey: string | null
    setFocusedKey: (key: string) => void
    expanded: Set<string>
    toggleExpanded: (key: string) => void
    registerCard: (key: string, node: HTMLDivElement | null) => void
    /** Passe le focus au libellé qui prend la place de `key` une fois traité. */
    advanceFrom: (key: string) => void
    /**
     * Donne le focus à une carte, sur un GESTE. Le focus n'est jamais pris au
     * montage (voir plus haut) : une reprise de classement passe donc par un
     * bouton, jamais par un autofocus.
     */
    focusCard: (key: string) => void
    handleKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void
}

export function usePackingReviewFocus({
    navigable,
    onEnter,
    onSpace,
    onDigit,
}: UsePackingReviewFocusOptions): PackingReviewFocus {
    const [focusedKey, setFocusedKey] = useState<string | null>(null)
    const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
    const cardsRef = useRef(new Map<string, HTMLDivElement>())
    const moveDomFocusRef = useRef(false)

    useEffect(() => {
        if (!moveDomFocusRef.current || !focusedKey) return
        moveDomFocusRef.current = false
        cardsRef.current.get(focusedKey)?.focus()
    }, [focusedKey, navigable])

    const moveTo = (key: string) => {
        moveDomFocusRef.current = true
        setFocusedKey(key)
    }

    const advanceFrom = (key: string) => {
        const index = navigable.findIndex((g) => g.key === key)
        if (index === -1) return
        const next = navigable[index + 1]?.key ?? navigable[index - 1]?.key ?? null
        if (next) moveTo(next)
    }

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        // Seulement quand la CARTE a le focus : Entrée dans la recherche d'une
        // liste de catégories ne doit pas confirmer le groupe.
        const target = event.target as HTMLElement
        const key = target.dataset.groupKey
        if (!key) return

        const index = navigable.findIndex((g) => g.key === key)
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault()
            const next = navigable[index + (event.key === "ArrowDown" ? 1 : -1)]
            if (next) moveTo(next.key)
        } else if (event.key === "Enter") {
            event.preventDefault()
            const group = navigable[index]
            if (group) onEnter(group)
        } else if (event.key === " ") {
            // Sans `preventDefault`, Espace fait défiler la sheet sous la liste
            // qu'on vient d'ouvrir.
            event.preventDefault()
            const group = navigable[index]
            if (group) onSpace?.(group)
        } else if (onDigit && /^[1-5]$/.test(event.key)) {
            // La garde `dataset.groupKey` ci-dessus suffit à isoler des champs
            // de saisie : un chiffre tapé dans une recherche n'arrive pas ici.
            event.preventDefault()
            const group = navigable[index]
            if (group) onDigit(group, Number(event.key) - 1)
        }
    }

    return {
        focusedKey,
        setFocusedKey,
        expanded,
        toggleExpanded: (key) =>
            setExpanded((current) => {
                const next = new Set(current)
                if (next.has(key)) next.delete(key)
                else next.add(key)
                return next
            }),
        registerCard: (key, node) => {
            if (node) cardsRef.current.set(key, node)
            else cardsRef.current.delete(key)
        },
        advanceFrom,
        focusCard: moveTo,
        handleKeyDown,
    }
}
