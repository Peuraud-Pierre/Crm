/**
 * Constantes de motion — miroirs JS des tokens CSS de `src/index.css`.
 *
 * Fichier volontairement pur (zéro React) pour rester importable depuis un
 * service, un test ou un `.ts` non-composant. Voir DESIGN_SYSTEM.md §13.
 */

/**
 * Durées, en SECONDES (unité attendue par framer-motion).
 * Miroir des tokens `--transition-duration-*`, qui sont en millisecondes.
 * Garder les deux échelles synchronisées.
 */
export const DURATION = {
    instant: 0.1,
    fast: 0.15,
    base: 0.2,
    slow: 0.3,
    slower: 0.5,
    glacial: 0.7,
} as const

/**
 * Courbes de Bézier, au format tableau attendu par framer-motion.
 * Miroir des tokens `--ease-*`.
 *
 * - `emphasized` (expo-out) : mouvement décidé par l'utilisateur — onglets,
 *   panneaux, sidebar.
 * - `overshoot` (back-out) : apparition d'un élément qui « arrive ».
 *   JAMAIS en sortie — un élément qui part ne rebondit pas.
 * - `decel` : micro-déplacements (< 8px).
 */
export const EASE = {
    emphasized: [0.22, 1, 0.36, 1],
    overshoot: [0.34, 1.56, 0.64, 1],
    decel: [0.25, 0.46, 0.45, 0.94],
} as const

/**
 * Délai de stagger PLAFONNÉ, en millisecondes.
 *
 * Le plafond est structurel, pas cosmétique : sans lui, la 60e ligne d'une
 * liste attend 2,4 s avant d'apparaître et l'utilisateur perçoit un bug de
 * chargement, pas une animation. Formalise la convention `Math.min(index * N, cap)`
 * déjà appliquée partout dans le CRM.
 */
export function staggerDelay(index: number, step = 40, cap = 400): number {
    if (index <= 0) return 0
    return Math.min(index * step, cap)
}

/**
 * Style inline prêt à poser sur un élément animé en CSS
 * (`animate-in ... fill-mode-backwards`).
 *
 * Retourne `undefined` quand le délai est nul, pour ne pas produire
 * d'attribut `style` inutile sur le premier élément.
 *
 * Pas de test `prefers-reduced-motion` ici : la media query globale de
 * `src/index.css` remet `animation-delay` à 0 — c'est précisément pourquoi
 * elle neutralise le délai et pas seulement la durée (DESIGN_SYSTEM.md §13.4).
 */
export function staggerStyle(
    index: number,
    opts?: { step?: number; cap?: number }
): { animationDelay: string } | undefined {
    const delay = staggerDelay(index, opts?.step, opts?.cap)
    return delay > 0 ? { animationDelay: `${delay}ms` } : undefined
}
