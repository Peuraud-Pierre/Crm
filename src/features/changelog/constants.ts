/**
 * Registre central des codes de permission de la feature changelog.
 * Aucun littéral de permission dans les composants.
 *
 * Note : les trois codes `changelogs.*` étaient consommés par les policies
 * RLS et par l'UI sans qu'aucune migration ne les crée — ils sont ajoutés
 * par la migration 20260824106000.
 */
export const CHANGELOG_PERMISSIONS = {
    /** Voir les brouillons et administrer les catégories. */
    manage: "manager.changelog",
    create: "changelogs.create",
    edit: "changelogs.edit",
    delete: "changelogs.delete",
} as const

/**
 * Fuseau de référence des dates de déploiement.
 *
 * Une date de déploiement désigne un instant unique pour toute
 * l'entreprise : elle ne doit pas se lire différemment selon le fuseau du
 * navigateur. C'est l'inverse d'une fenêtre de maintenance ou d'une
 * annonce, saisies en heure locale — voir `shared/lib/datetimeLocal.ts`.
 */
export const DEPLOY_TZ = "Europe/Paris"

/**
 * Dimensions du dialogue d'édition d'une version.
 *
 * Écrite une fois : la chaîne était copiée mot pour mot dans
 * `ChangelogAdmin` (création) et `ChangelogVersionCard` (modification),
 * et une chaîne dupliquée finit toujours par diverger d'un côté.
 *
 * Les valeurs sont arbitraires à dessein (`CLAUDE.md`) : ce sont des
 * dimensions de fenêtre, pas des dimensions de contenu — l'éditeur doit
 * tenir à l'écran quel que soit celui-ci, et sa largeur utile change à
 * chaque palier parce que le formulaire passe d'une à deux colonnes.
 */
export const CHANGELOG_DIALOG_SIZE =
    "max-h-[90vh] max-w-[95vw] overflow-y-auto rounded-xl p-0 " +
    "sm:max-w-[700px] sm:p-4 lg:max-w-[1100px] lg:p-6"
