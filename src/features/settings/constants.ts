/**
 * Espace « Paramètres » — réglages du compte de l'utilisateur connecté.
 *
 * Frontière avec `features/profile` : le profil porte **l'identité** (qui je
 * suis : nom, photo, coordonnées) ; les paramètres portent **le
 * comportement** de l'application (sécurité, préférences, intégrations).
 *
 * Cette feature consomme les hooks et services de `features/profile`
 * (`hooks/data/useUserPreferences`, `usePushPreference`,
 * `useNewsletterSubscription`, `useProfileDetails`, `services/profileService`)
 * : ce sont des données **de l'utilisateur**, dont le profil reste
 * propriétaire. La dépendance est unidirectionnelle — `features/profile`
 * n'importe jamais `features/settings`.
 */

/** Réutilise le code d'accès de la page profil : pas de seed supplémentaire. */
export const SETTINGS_PERMISSIONS = {
    view: "profile.view",
    newsletterView: "stock.arrivage.newsletter.view",
} as const

/** Slugs de section de la page /settings/:section? */
export const SETTINGS_SECTIONS = {
    security: "securite",
    preferences: "preferences",
    integrations: "integrations",
} as const

export type SettingsSection =
    (typeof SETTINGS_SECTIONS)[keyof typeof SETTINGS_SECTIONS]
