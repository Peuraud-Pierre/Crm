// ── useLiveRef.ts ──────────────────────────────────────────────────────────────
// RÔLE : miroir synchrone d'une valeur dans un useRef, pour la lire à jour dans
// un useCallback/useEffect SANS l'ajouter à ses dépendances (ce qui forcerait
// sa recréation à chaque changement de la valeur — le pattern "event handler
// ref" de React : https://react.dev/learn/separating-events-from-effects).
//
// Le ref est réassigné à chaque render (pas dans un useEffect, qui ne
// s'exécuterait qu'après le rendu suivant et laisserait une fenêtre où le ref
// serait en retard d'un cycle).
//
// Utilisé partout où une valeur "fraîche" doit être lue depuis un callback
// mémoïsé sans faire partie de ses dépendances (ex: le dialog actif, l'état
// de navigation, une liste de données) — voir feature bibliotheque
// (useDialog.ts, useBibli.ts, useBiblioPage.ts) pour des exemples d'usage.

import { useRef } from "react"
import type { RefObject } from "react"

export function useLiveRef<T>(value: T): RefObject<T> {
    const ref = useRef(value)
    ref.current = value
    return ref
}
