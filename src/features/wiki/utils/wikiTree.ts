// Fonctions pures de manipulation de l'arborescence de catégories du wiki.
// Aucune dépendance React / aucun effet de bord (guide Architecture §8.3).

import type {
    WikiCategory,
    WikiCategoryFlat,
    WikiCategoryMove,
    WikiCategoryNode,
} from "../types/wiki-category.types"

/** Ordre canonique des catégories (= tri serveur : position puis nom). */
export const byPositionThenName = (a: WikiCategory, b: WikiCategory) =>
    a.position - b.position || a.name.localeCompare(b.name)

/** Construit l'arborescence (racines + enfants récursifs) à partir de la liste plate. */
export function buildCategoryTree(
    categories: WikiCategory[]
): WikiCategoryNode[] {
    const byId = new Map<string, WikiCategoryNode>()
    for (const category of categories) {
        byId.set(category.id, { ...category, children: [] })
    }

    const roots: WikiCategoryNode[] = []
    for (const node of byId.values()) {
        const parent = node.parent_id ? byId.get(node.parent_id) : undefined
        if (parent) parent.children.push(node)
        else roots.push(node)
    }

    const sortRec = (nodes: WikiCategoryNode[]) => {
        nodes.sort(byPositionThenName)
        nodes.forEach((n) => sortRec(n.children))
    }
    sortRec(roots)
    return roots
}

/** Chemin racine → catégorie (pour le fil d'Ariane). */
export function getCategoryPath(
    categories: WikiCategory[],
    id: string | null
): WikiCategory[] {
    if (!id) return []
    const byId = new Map(categories.map((c) => [c.id, c]))
    const path: WikiCategory[] = []
    let current = byId.get(id)
    const seen = new Set<string>()
    while (current && !seen.has(current.id)) {
        seen.add(current.id)
        path.unshift(current)
        current = current.parent_id
            ? byId.get(current.parent_id)
            : undefined
    }
    return path
}

/** Enfants directs d'une catégorie (ou racines si id null). */
export function getChildCategories(
    categories: WikiCategory[],
    parentId: string | null
): WikiCategory[] {
    return categories
        .filter((c) => c.parent_id === parentId)
        .sort(byPositionThenName)
}

/**
 * Nombre d'articles par branche (catégorie + tous ses descendants), calculé en
 * une seule passe O(catégories + articles).
 *
 * Remplace un comptage naïf O(N²) (un parcours de descendants par nœud rendu).
 * Le résultat se mémoïse au niveau du provider ; les composants n'ont plus qu'à
 * lire la map. Robuste aux cycles éventuels de `parent_id`.
 */
export function buildBranchArticleCounts(
    categories: WikiCategory[],
    articleCategoryIds: (string | null)[]
): Map<string, number> {
    const direct = new Map<string, number>()
    for (const cid of articleCategoryIds) {
        if (!cid) continue
        direct.set(cid, (direct.get(cid) ?? 0) + 1)
    }

    const childrenOf = new Map<string, string[]>()
    for (const c of categories) {
        if (!c.parent_id) continue
        const list = childrenOf.get(c.parent_id) ?? []
        list.push(c.id)
        childrenOf.set(c.parent_id, list)
    }

    const counts = new Map<string, number>()
    const visiting = new Set<string>()
    const compute = (id: string): number => {
        const cached = counts.get(id)
        if (cached !== undefined) return cached
        if (visiting.has(id)) return 0 // garde anti-cycle
        visiting.add(id)
        let total = direct.get(id) ?? 0
        for (const child of childrenOf.get(id) ?? []) total += compute(child)
        visiting.delete(id)
        counts.set(id, total)
        return total
    }
    for (const c of categories) compute(c.id)
    return counts
}

/** Aplatit l'arbre en préordre avec la profondeur (pour les <select> indentés). */
export function flattenTreeWithDepth(
    nodes: WikiCategoryNode[],
    depth = 0
): WikiCategoryFlat[] {
    const out: WikiCategoryFlat[] = []
    for (const node of nodes) {
        out.push({ category: node, depth })
        out.push(...flattenTreeWithDepth(node.children, depth + 1))
    }
    return out
}

// ────────────────────────────────────────────────────────────────────────────
// Réorganisation (drag & drop) — voir components/category/CategoryManager.tsx
// ────────────────────────────────────────────────────────────────────────────

/**
 * `candidateId` est-il `ancestorId` ou l'un de ses descendants ?
 *
 * Miroir côté client de la garde anti-cycle SQL : sert à refuser un drop d'une
 * catégorie dans sa propre branche avant même l'appel réseau. Robuste aux
 * cycles `parent_id` déjà présents en base (borne `seen`).
 */
export function isSelfOrDescendant(
    categories: WikiCategory[],
    candidateId: string | null,
    ancestorId: string
): boolean {
    if (!candidateId) return false
    const byId = new Map(categories.map((c) => [c.id, c]))
    const seen = new Set<string>()
    let current: string | null = candidateId
    while (current && !seen.has(current)) {
        if (current === ancestorId) return true
        seen.add(current)
        current = byId.get(current)?.parent_id ?? null
    }
    return false
}

/**
 * Projette la position de dépôt pendant un drag sur la liste aplatie.
 *
 * Recette dnd-kit « sortable tree » : l'index vertical donne le voisin, le
 * décalage horizontal donne la profondeur souhaitée. Celle-ci est bornée par
 * [profondeur du voisin suivant, profondeur du voisin précédent + 1] — on ne
 * peut pas créer de trou dans l'arbre.
 *
 * @param items    liste aplatie SANS le nœud tiré ni ses descendants
 * @param overIndex index d'insertion visé dans `items` (0 = tout en haut)
 * @param offsetX  décalage horizontal cumulé du drag, en pixels
 * @param indentPx largeur d'un niveau d'indentation
 */
export function projectDrop(
    items: WikiCategoryFlat[],
    overIndex: number,
    offsetX: number,
    indentPx: number
): { parentId: string | null; depth: number; index: number } {
    const clampedIndex = Math.max(0, Math.min(overIndex, items.length))
    const previous = items[clampedIndex - 1]
    const next = items[clampedIndex]

    const maxDepth = previous ? previous.depth + 1 : 0
    const minDepth = next ? next.depth : 0
    const wanted = (previous?.depth ?? 0) + Math.round(offsetX / indentPx)
    const depth = Math.max(minDepth, Math.min(wanted, maxDepth))

    // Le parent est le premier voisin au-dessus dont la profondeur vaut
    // `depth - 1` (à profondeur 0, on retombe sur une racine).
    let parentId: string | null = null
    if (depth > 0) {
        for (let i = clampedIndex - 1; i >= 0; i--) {
            if (items[i].depth === depth - 1) {
                parentId = items[i].category.id
                break
            }
        }
    }

    // Rang dans la fratrie cible = nombre de frères déjà présents au-dessus.
    let index = 0
    for (let i = 0; i < clampedIndex; i++) {
        if ((items[i].category.parent_id ?? null) === parentId) index++
    }

    return { parentId, depth, index }
}

/**
 * Calcule le patch minimal à envoyer après un déplacement : les fratries
 * source et cible sont renumérotées en 0..n-1 (les positions historiques sont
 * toutes à 0, on ne peut donc pas se contenter d'insérer entre deux valeurs).
 *
 * Renvoie un tableau vide si le déplacement est un no-op ou interdit (cycle).
 */
export function computeReorder(
    categories: WikiCategory[],
    activeId: string,
    parentId: string | null,
    index: number
): WikiCategoryMove[] {
    const active = categories.find((c) => c.id === activeId)
    if (!active) return []
    if (isSelfOrDescendant(categories, parentId, activeId)) return []

    const sourceParent = active.parent_id ?? null
    const siblingsOf = (pid: string | null) =>
        categories
            .filter((c) => (c.parent_id ?? null) === pid && c.id !== activeId)
            .sort(byPositionThenName)

    const target = siblingsOf(parentId)
    target.splice(Math.max(0, Math.min(index, target.length)), 0, active)

    const moves = new Map<string, WikiCategoryMove>()
    const renumber = (list: WikiCategory[], pid: string | null) => {
        list.forEach((c, i) => {
            const nextParent = c.id === activeId ? parentId : pid
            if (c.position === i && (c.parent_id ?? null) === nextParent) return
            moves.set(c.id, { id: c.id, parent_id: nextParent, position: i })
        })
    }

    renumber(target, parentId)
    if (sourceParent !== parentId) renumber(siblingsOf(sourceParent), sourceParent)

    return [...moves.values()]
}

/** Applique un patch de déplacement à une liste plate (mise à jour optimiste). */
export function applyMoves(
    categories: WikiCategory[],
    moves: WikiCategoryMove[]
): WikiCategory[] {
    const byId = new Map(moves.map((m) => [m.id, m]))
    return categories
        .map((c) => {
            const move = byId.get(c.id)
            return move
                ? { ...c, parent_id: move.parent_id, position: move.position }
                : c
        })
        .sort(byPositionThenName)
}

/** Ids d'une catégorie et de toute sa descendance (repli pendant le drag). */
export function collectBranchIds(
    categories: WikiCategory[],
    rootId: string
): Set<string> {
    const childrenOf = new Map<string, string[]>()
    for (const c of categories) {
        if (!c.parent_id) continue
        const list = childrenOf.get(c.parent_id) ?? []
        list.push(c.id)
        childrenOf.set(c.parent_id, list)
    }
    const out = new Set<string>()
    const walk = (id: string) => {
        if (out.has(id)) return // garde anti-cycle
        out.add(id)
        for (const child of childrenOf.get(id) ?? []) walk(child)
    }
    walk(rootId)
    return out
}
