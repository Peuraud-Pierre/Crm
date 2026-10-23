import { expect, test } from "@rstest/core"
import {
    applyMoves,
    buildCategoryTree,
    collectBranchIds,
    computeReorder,
    flattenTreeWithDepth,
    isSelfOrDescendant,
    projectDrop,
} from "./wikiTree"
import type { WikiCategory } from "../types/wiki-category.types"

/** Fabrique une catégorie minimale (seuls parent_id/position comptent ici). */
const cat = (
    id: string,
    parent_id: string | null,
    position: number,
    name = id
): WikiCategory => ({
    id,
    parent_id,
    name,
    position,
    created_at: "2026-06-29T00:00:00Z",
})

//   stock (0)
//     ├ arrivage (0)
//     │   └ creation (0)
//     └ inventaire (1)
//   rh (1)
const tree: WikiCategory[] = [
    cat("stock", null, 0),
    cat("rh", null, 1),
    cat("arrivage", "stock", 0),
    cat("inventaire", "stock", 1),
    cat("creation", "arrivage", 0),
]

// ── isSelfOrDescendant ──────────────────────────────────────────────────────

test("isSelfOrDescendant reconnaît le nœud lui-même et sa descendance", () => {
    expect(isSelfOrDescendant(tree, "stock", "stock")).toBe(true)
    expect(isSelfOrDescendant(tree, "creation", "stock")).toBe(true)
    expect(isSelfOrDescendant(tree, "rh", "stock")).toBe(false)
    expect(isSelfOrDescendant(tree, null, "stock")).toBe(false)
})

test("isSelfOrDescendant ne boucle pas sur un parent_id cyclique", () => {
    const corrupted = [cat("a", "b", 0), cat("b", "a", 0)]
    expect(isSelfOrDescendant(corrupted, "a", "zzz")).toBe(false)
})

// ── computeReorder ──────────────────────────────────────────────────────────

test("computeReorder reparente une catégorie racine sous une autre", () => {
    const moves = computeReorder(tree, "rh", "stock", 2)
    const rh = moves.find((m) => m.id === "rh")
    expect(rh).toEqual({ id: "rh", parent_id: "stock", position: 2 })

    const moved = applyMoves(tree, moves)
    const roots = buildCategoryTree(moved)
    expect(roots.map((r) => r.id)).toEqual(["stock"])
    expect(roots[0].children.map((c) => c.id)).toEqual([
        "arrivage",
        "inventaire",
        "rh",
    ])
})

test("computeReorder réordonne dans la fratrie et renumérote 0..n-1", () => {
    // inventaire passe devant arrivage
    const moves = computeReorder(tree, "inventaire", "stock", 0)
    const moved = applyMoves(tree, moves)
    const stock = buildCategoryTree(moved)[0]
    expect(stock.children.map((c) => c.id)).toEqual(["inventaire", "arrivage"])
    expect(stock.children.map((c) => c.position)).toEqual([0, 1])
})

test("computeReorder refuse de déplacer un nœud dans sa propre branche", () => {
    expect(computeReorder(tree, "stock", "creation", 0)).toEqual([])
    expect(computeReorder(tree, "stock", "stock", 0)).toEqual([])
})

test("computeReorder ne renvoie rien quand la position ne change pas", () => {
    // arrivage est déjà en position 0 sous stock
    expect(computeReorder(tree, "arrivage", "stock", 0)).toEqual([])
})

test("computeReorder ignore un id inconnu", () => {
    expect(computeReorder(tree, "inexistant", null, 0)).toEqual([])
})

// ── projectDrop ─────────────────────────────────────────────────────────────

test("projectDrop borne la profondeur par le voisin précédent + 1", () => {
    const items = flattenTreeWithDepth(buildCategoryTree(tree))
    // Insertion juste après « creation » (depth 2) avec un fort décalage à
    // droite : on ne peut pas dépasser depth 3.
    const index = items.findIndex((i) => i.category.id === "inventaire")
    const deep = projectDrop(items, index, 999, 18)
    expect(deep.depth).toBe(items[index - 1].depth + 1)

    // Décalage à gauche : on retombe au minimum sur la profondeur du suivant.
    const shallow = projectDrop(items, index, -999, 18)
    expect(shallow.depth).toBe(items[index].depth)
})

test("projectDrop résout le parent à partir de la profondeur visée", () => {
    const items = flattenTreeWithDepth(buildCategoryTree(tree))
    const index = items.findIndex((i) => i.category.id === "rh")
    // Tout en bas, sans décalage : on reste au niveau racine.
    expect(projectDrop(items, items.length, 0, 18).parentId).toBe(null)
    // Devant « rh », le voisin du dessus est « inventaire » (depth 1) : sans
    // décalage on hérite de sa profondeur, donc de son parent.
    expect(projectDrop(items, index, 0, 18)).toMatchObject({
        depth: 1,
        parentId: "stock",
    })
    // Tiré vers la gauche, on redevient une racine.
    expect(projectDrop(items, index, -999, 18)).toMatchObject({
        depth: 0,
        parentId: null,
    })
})

// ── collectBranchIds ────────────────────────────────────────────────────────

test("collectBranchIds retourne le nœud et toute sa descendance", () => {
    expect([...collectBranchIds(tree, "stock")].sort()).toEqual([
        "arrivage",
        "creation",
        "inventaire",
        "stock",
    ])
    expect([...collectBranchIds(tree, "rh")]).toEqual(["rh"])
})

test("collectBranchIds ne boucle pas sur un arbre cyclique", () => {
    const corrupted = [cat("a", "b", 0), cat("b", "a", 0)]
    expect([...collectBranchIds(corrupted, "a")].sort()).toEqual(["a", "b"])
})
