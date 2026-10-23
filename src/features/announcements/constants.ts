import type { AnnouncementType } from "./types/announcement.types"
/**
 * Registre central des codes de permission et constantes de la feature
 * annonces. Aucun littéral de permission dans les composants.
 */
export const ANNOUNCEMENT_PERMISSIONS = {
    /** Créer / modifier / archiver / supprimer une annonce, et tout voir. */
    manage: "manager.annonce",
} as const

/** Bucket de stockage des images (migration 20260824105000). */
export const ANNOUNCEMENT_BUCKET = "annonces"

/**
 * Taille maximale d'une image d'annonce.
 *
 * L'ancien formulaire n'imposait aucune limite et encodait le fichier en
 * base64 dans la colonne : une photo de 8 Mo devenait ~11 Mo de texte
 * chargés par chaque utilisateur à l'ouverture de l'application.
 */
export const ANNOUNCEMENT_IMAGE_MAX_BYTES = 2 * 1024 * 1024

/**
 * Rubriques — contraintes en base par `annonce_type_check`.
 *
 * Cinq et non trois : `celebration` et `release` étaient jusqu'ici
 * versées de force dans `event` et `news`, ce qui les rendait
 * indistinguables. Ce sont pourtant les deux rubriques qui font
 * qu'un journal interne en est un.
 */
export const ANNOUNCEMENT_TYPES = [
    "news",
    "event",
    "celebration",
    "release",
    "message",
] as const

export const ANNOUNCEMENT_TYPE_LABELS: Record<AnnouncementType, string> = {
    news: "Actualité",
    event: "Événement",
    celebration: "Félicitations",
    release: "Mise à jour",
    message: "Message",
}

/**
 * Teinte de chaque rubrique.
 *
 * Les classes sont écrites en entier : Tailwind lit le source pour
 * savoir quoi générer, une classe assemblée à l'exécution n'existerait
 * pas dans la feuille de style.
 *
 * `success` pour les félicitations et `primary` pour l'actualité sont
 * des choix sémantiques assumés — une félicitation est une bonne
 * nouvelle, et le vert de marque est celui de l'entreprise qui parle.
 * Les autres rubriques prennent des teintes catégorielles, qui ne
 * prétendent rien annoncer d'autre qu'une différence.
 */
export const ANNOUNCEMENT_TYPE_ACCENT: Record<
    AnnouncementType,
    { rule: string; text: string; wash: string }
> = {
    news: {
        rule: "bg-primary",
        text: "text-primary",
        wash: "from-primary/5",
    },
    event: {
        rule: "bg-chart-2",
        text: "text-chart-2",
        wash: "from-chart-2/5",
    },
    celebration: {
        rule: "bg-success",
        text: "text-success",
        wash: "from-success/5",
    },
    release: {
        rule: "bg-chart-4",
        text: "text-chart-4",
        wash: "from-chart-4/5",
    },
    message: {
        rule: "bg-chart-8",
        text: "text-chart-8",
        wash: "from-chart-8/5",
    },
}

/** Longueur maximale du chapô — bornée en base par `annonce_excerpt_len_check`. */
export const ANNOUNCEMENT_EXCERPT_MAX = 280

/** Longueur maximale du corps — bornée par `annonce_body_len_check`. */
export const ANNOUNCEMENT_BODY_MAX = 20000
