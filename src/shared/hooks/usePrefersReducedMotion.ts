import { useSyncExternalStore } from "react"

const QUERY = "(prefers-reduced-motion: reduce)"

/**
 * MediaQueryList unique pour tout l'arbre React.
 *
 * Pourquoi ne pas utiliser `useReducedMotion()` de framer-motion : ce hook
 * crée un `matchMedia` + un listener À CHAQUE APPEL. Appelé dans le rendu
 * d'une ligne de liste, il produit autant d'abonnements que de lignes —
 * mesuré à ~100 abonnements media-query par page sur `arrivage-admin`
 * (voir docs/PLAN_ASSAINISSEMENT.md et DESIGN_SYSTEM.md §13.5).
 *
 * Le correctif retenu n'est pas de remonter la valeur au parent au cas par
 * cas (discipline non tenable, oubliée à chaque nouveau composant) mais un
 * store au niveau du module : un seul listener natif, quel que soit le
 * nombre de composants abonnés.
 */
const mql = typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(QUERY)
    : null

const listeners = new Set<() => void>()

function notify() {
    for (const listener of listeners) listener()
}

function subscribe(onStoreChange: () => void): () => void {
    listeners.add(onStoreChange)
    // Le listener natif n'est attaché qu'au premier abonné et détaché au
    // dernier départ — d'où le test sur la taille du Set.
    if (mql && listeners.size === 1) {
        mql.addEventListener("change", notify)
    }
    return () => {
        listeners.delete(onStoreChange)
        if (mql && listeners.size === 0) {
            mql.removeEventListener("change", notify)
        }
    }
}

function getSnapshot(): boolean {
    return mql?.matches ?? false
}

/** Valeur serveur/pré-hydratation : on suppose l'absence de préférence. */
function getServerSnapshot(): boolean {
    return false
}

/**
 * `true` si l'utilisateur a demandé une réduction des animations.
 *
 * À n'utiliser que pour les animations pilotées en JS (framer-motion, anime.js) :
 * tout ce qui est CSS est déjà neutralisé par la media query globale de
 * `src/index.css` — voir DESIGN_SYSTEM.md §13.4.
 */
export function usePrefersReducedMotion(): boolean {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
