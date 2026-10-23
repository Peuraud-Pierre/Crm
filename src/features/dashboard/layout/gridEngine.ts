import type { SizeBounds } from "@/shared/types/widget.types"
import { GRID_COLS, MAX_ROWS, MIN_COLS, MIN_ROWS } from "../constants"
import type { LayoutItem } from "../types/layout.types"

/**
 * Moteur de placement du canevas.
 *
 * Fonctions **pures, sans React** : c'est le seul endroit où vit la
 * logique d'agencement, et le seul qui a besoin d'être vraiment testé.
 * Les composants ne font que rendre le résultat et lui envoyer des
 * gestes.
 *
 * Deux partis pris, qui sont la raison d'être de cette refonte :
 *
 * 1. **Poussée vers le bas, jamais permutation.** Un module déposé sur un
 *    autre le fait descendre. La permutation — le comportement d'une
 *    liste triable — donne l'impression que la page décide à la place de
 *    l'utilisateur.
 * 2. **Gravité vers le haut**, sauf pour le module qu'on vient de
 *    manipuler. Sans gravité du tout, retirer un module laisse un trou
 *    définitif et il faut ranger à la main. Avec une gravité qui
 *    s'applique aussi au module manipulé — ce que faisait la première
 *    version —, on ne peut ni descendre un module dans une zone vide, ni
 *    le rétrécir par le bord haut : le geste est annulé au relâchement.
 *    L'épingle est ce qui rend la grille réellement libre ; les trous
 *    qu'elle autorise sont ceux que l'utilisateur a voulus.
 */

export interface Rect {
    x: number
    y: number
    w: number
    h: number
}

/** Chevauchement de deux rectangles (les bords jointifs ne comptent pas). */
export function collides(a: Rect, b: Rect): boolean {
    return (
        a.x < b.x + b.w &&
        a.x + a.w > b.x &&
        a.y < b.y + b.h &&
        a.y + a.h > b.y
    )
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max)
}

/**
 * Ramène un rectangle dans les bornes du widget **et** dans celles de la
 * grille. La largeur est bornée avant la position : sinon un module large
 * poussé contre le bord droit verrait sa largeur amputée alors qu'il
 * suffisait de le décaler.
 */
export function clampRect(rect: Rect, bounds: SizeBounds): Rect {
    const w = clamp(
        Math.round(rect.w),
        Math.max(1, bounds.minW ?? MIN_COLS),
        Math.min(bounds.maxW ?? GRID_COLS, GRID_COLS)
    )
    const h = clamp(
        Math.round(rect.h),
        Math.max(1, bounds.minH ?? MIN_ROWS),
        bounds.maxH ?? MAX_ROWS
    )

    return {
        w,
        h,
        x: clamp(Math.round(rect.x), 0, GRID_COLS - w),
        y: Math.max(0, Math.round(rect.y)),
    }
}

/**
 * Le même module à une nouvelle ordonnée — ou **l'objet d'origine** si
 * elle ne change pas.
 *
 * Ce n'est pas une micro-optimisation de calcul : recopier
 * systématiquement coûte à peu près rien ici. Ce qui coûte, c'est en
 * aval. Le canevas rend une carte par module et, dans chaque carte, le
 * module lui-même ; React ne peut sauter ce travail que si la référence
 * n'a pas bougé. Or un geste ne déplace presque jamais tout le monde :
 * mesuré sur douze modules, un geste sans effet renouvelait douze
 * identités pour zéro position changée, ce qui rendait toute mémoïsation
 * inopérante.
 *
 * Les fonctions restent pures — elles ne modifient jamais l'objet reçu,
 * elles se contentent de le réutiliser tel quel quand il est déjà juste.
 */
function atY(item: LayoutItem, y: number): LayoutItem {
    return y === item.y ? item : { ...item, y }
}

/** Idem pour un rectangle complet. */
function atRect(item: LayoutItem, rect: Rect): LayoutItem {
    return item.x === rect.x &&
        item.y === rect.y &&
        item.w === rect.w &&
        item.h === rect.h
        ? item
        : { ...item, ...rect }
}

/** Ordre de lecture : de haut en bas, puis de gauche à droite. */
function byReadingOrder(a: LayoutItem, b: LayoutItem): number {
    return a.y - b.y || a.x - b.x
}

/** Réindexe une liste recalculée sur l'ordre du tableau d'origine. */
function restoreOrder(
    original: LayoutItem[],
    computed: LayoutItem[]
): LayoutItem[] {
    const byId = new Map(computed.map((i) => [i.instanceId, i]))
    return original.map((i) => byId.get(i.instanceId) ?? i)
}

/**
 * Descend tout ce qui chevauche `movingId`, qui lui ne bouge pas.
 *
 * Les autres modules sont traités dans l'ordre de lecture, donc un
 * module déjà descendu peut à son tour en pousser un troisième : la
 * cascade est résolue en une passe.
 */
export function resolveCollisions(
    items: LayoutItem[],
    movingId: string
): LayoutItem[] {
    const moving = items.find((i) => i.instanceId === movingId)
    if (!moving) return items

    // `moving` est réutilisé tel quel : plus rien n'est modifié en place
    // ici, les nouvelles positions passent toutes par `atY`.
    const settled: LayoutItem[] = [moving]

    for (const item of items
        .filter((i) => i.instanceId !== movingId)
        .sort(byReadingOrder)) {
        let y = item.y

        // Borne de sûreté : chaque passage fait strictement descendre
        // `y`, donc la boucle termine ; le compteur ne protège que
        // d'une donnée aberrante venue de la base.
        for (let guard = 0; guard <= settled.length; guard++) {
            const hit = settled.find((s) => collides({ ...item, y }, s))
            if (!hit) break
            y = hit.y + hit.h
        }

        settled.push(atY(item, y))
    }

    return restoreOrder(items, settled)
}

/**
 * Fait remonter chaque module aussi haut que possible, sans chevauchement.
 *
 * `pinnedId` en est exempté : il garde le `y` qu'on lui a donné. C'est le
 * module que l'utilisateur est en train de manipuler, et c'est la seule
 * façon de lui laisser le poser plus bas qu'il ne « tomberait », ou de le
 * rétrécir par son bord haut.
 *
 * Sans épingle — retrait d'un module, réparation d'une disposition venue
 * de la base — la gravité s'applique à tous : un trou subi n'est pas un
 * trou voulu, et personne n'a envie de ranger sa page à la main.
 *
 * L'ordre de lecture garantit qu'un module épinglé est posé avant tous
 * ceux qui sont sous lui : ils ne peuvent donc pas remonter à travers.
 */
export function compact(
    items: LayoutItem[],
    pinnedId?: string
): LayoutItem[] {
    const placed: LayoutItem[] = []

    for (const item of [...items].sort(byReadingOrder)) {
        let y = item.y

        if (item.instanceId !== pinnedId) {
            while (
                y > 0 &&
                !placed.some((p) => collides({ ...item, y: y - 1 }, p))
            ) {
                y -= 1
            }
        }

        placed.push(atY(item, y))
    }

    return restoreOrder(items, placed)
}

/**
 * Répare une disposition venant de la base : les chevauchements sont
 * défaits en poussant vers le bas dans l'ordre de lecture, puis la
 * gravité s'applique.
 *
 * Sur une disposition saine — c'est-à-dire toute disposition écrite par
 * ce front, qui compacte après chaque geste — c'est une opération
 * neutre. Elle ne sert qu'aux dispositions écrites à la main, migrées
 * d'un ancien format, ou dont les bornes de taille ont changé depuis.
 */
export function normalize(items: LayoutItem[]): LayoutItem[] {
    const placed: LayoutItem[] = []

    for (const item of [...items].sort(byReadingOrder)) {
        let y = item.y

        for (let guard = 0; guard <= placed.length; guard++) {
            const hit = placed.find((p) => collides({ ...item, y }, p))
            if (!hit) break
            y = hit.y + hit.h
        }

        placed.push(atY(item, y))
    }

    return compact(restoreOrder(items, placed))
}

/**
 * Applique un geste (déplacement ou redimensionnement) et rend la
 * disposition résultante. C'est la seule fonction que l'UI appelle.
 *
 * Le module du geste est épinglé : il reste exactement où on le met.
 */
export function place(
    items: LayoutItem[],
    instanceId: string,
    rect: Rect,
    bounds: SizeBounds
): LayoutItem[] {
    const clamped = clampRect(rect, bounds)

    const moved = items.map((i) =>
        i.instanceId === instanceId ? atRect(i, clamped) : i
    )

    return compact(resolveCollisions(moved, instanceId), instanceId)
}

/**
 * Premier emplacement libre pour un module de cette taille, en balayant
 * de haut en bas puis de gauche à droite. Sert à l'ajout depuis le
 * catalogue : le module se pose dans le premier trou, pas systématiquement
 * en bas de page.
 */
export function firstFreeSpot(
    items: LayoutItem[],
    w: number,
    h: number
): { x: number; y: number } {
    const width = clamp(w, 1, GRID_COLS)
    const bottom = contentRows(items)

    for (let y = 0; y <= bottom; y++) {
        for (let x = 0; x <= GRID_COLS - width; x++) {
            const candidate = { x, y, w: width, h }
            if (!items.some((i) => collides(candidate, i))) return { x, y }
        }
    }

    return { x: 0, y: bottom }
}

/** Nombre de lignes occupées — hauteur du canevas. */
export function contentRows(items: LayoutItem[]): number {
    return items.reduce((max, i) => Math.max(max, i.y + i.h), 0)
}

/**
 * Ordre d'empilement en colonne unique, sous le point de rupture
 * d'édition. Dérivé à l'affichage, jamais persisté : il n'y a qu'une
 * disposition, celle à 12 colonnes.
 */
export function stackOrder(items: LayoutItem[]): LayoutItem[] {
    return [...items].sort(byReadingOrder)
}

/** Bord ou coin saisi lors d'un redimensionnement. */
export type ResizeEdge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw"

/**
 * Rectangle visé par un redimensionnement, **bord opposé ancré**.
 *
 * Tirer par l'ouest doit laisser le bord droit exactement où il est ; par
 * le nord, le bord bas. C'est ce qui distingue un redimensionnement d'un
 * déplacement, et c'est aussi ce que `clampRect` seul ne sait pas faire :
 * il borne la largeur puis replace `x` sur la grille, ce qui ferait
 * glisser le rectangle une fois `minW` atteint. On borne donc la taille
 * en premier et on en déduit la position.
 */
export function resizeRect(
    origin: Rect,
    edge: ResizeEdge,
    dCols: number,
    dRows: number,
    bounds: SizeBounds
): Rect {
    const minW = Math.max(1, bounds.minW ?? MIN_COLS)
    const minH = Math.max(1, bounds.minH ?? MIN_ROWS)
    const maxW = Math.min(bounds.maxW ?? GRID_COLS, GRID_COLS)
    const maxH = bounds.maxH ?? MAX_ROWS

    let { x, y, w, h } = origin

    if (edge.includes("e")) {
        // Le bord gauche est ancré : la largeur bute sur le bord droit
        // de la grille.
        w = clamp(origin.w + dCols, minW, Math.min(maxW, GRID_COLS - origin.x))
    }

    if (edge.includes("w")) {
        // Le bord droit est ancré : la largeur bute sur le bord gauche
        // de la grille, atteint quand `x` vaut 0.
        w = clamp(origin.w - dCols, minW, Math.min(maxW, origin.x + origin.w))
        x = origin.x + origin.w - w
    }

    if (edge.includes("s")) {
        h = clamp(origin.h + dRows, minH, maxH)
    }

    if (edge.includes("n")) {
        // Le bord bas est ancré ; vers le haut, on s'arrête à la ligne 0.
        h = clamp(origin.h - dRows, minH, Math.min(maxH, origin.y + origin.h))
        y = origin.y + origin.h - h
    }

    return { x, y, w, h }
}
