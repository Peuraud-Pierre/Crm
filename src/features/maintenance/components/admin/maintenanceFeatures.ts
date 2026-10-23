import { menuItems } from "@/shared/components/layout/menuItems"

/**
 * Features qu'on refuse de proposer à la mise en maintenance.
 *
 * Ce ne sont pas des modules métier mais des passages obligés : couper
 * `/dashboard` (page d'accueil de tout le monde), `/profile` ou
 * `/settings` enfermerait les utilisateurs sans rien réparer. Pour ces
 * cas-là, la maintenance globale est la bonne réponse.
 */
const NON_MAINTAINABLE = new Set(["dashboard", "profile", "settings"])

export interface FeatureOption {
    /** `title` de l'entrée menuItems — la clé stockée en base. */
    key: string
    /** Libellé affiché à l'administrateur. */
    label: string
}

/**
 * Features proposables, dérivées du registre central `menuItems.ts`.
 *
 * Aucune liste parallèle à maintenir : ajouter une feature à
 * `menuItems` la rend automatiquement éligible à la maintenance ciblée,
 * à condition que sa route porte le `featureKey` correspondant dans son
 * `handle` (cf. `src/app/routes/router.tsx`).
 */
export function listMaintainableFeatures(): FeatureOption[] {
    return menuItems
        .filter((item) => !NON_MAINTAINABLE.has(item.title))
        .map((item) => ({ key: item.title, label: item.displayName }))
        .sort((a, b) => a.label.localeCompare(b.label, "fr"))
}

/** Libellé affichable d'une clé de feature, ou la clé si elle est inconnue. */
export function featureLabel(key: string | null): string {
    if (!key) return "Application entière"
    return menuItems.find((i) => i.title === key)?.displayName ?? key
}
