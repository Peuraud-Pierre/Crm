// ── constants.ts ──────────────────────────────────────────────────────────────
// RÔLE : Centralise toutes les constantes immuables de la feature Bibliothèque.
//   - UI_TEXT : tous les textes affichés dans l'interface, en français ET en anglais.
//   - FORMAT_LABELS : libellés des onglets de canaux (Email, DM Instagram, WhatsApp).
//   - FORMAT_CHANNELS : tableau des clés de canaux, utilisé pour itérer.
//   - iconPath : fonction utilitaire qui construit le chemin d'une icône de canal.
//
// Pourquoi centraliser ici ? Pour éviter les "magic strings" : des chaînes de
// caractères éparpillées dans le code qu'on oublie de mettre à jour partout.
// Si un texte change, on le modifie UNE seule fois ici, et tout l'appli suit.
//
// CE FICHIER EST IMPORTÉ PAR :
//   - hooks/useBiblioPage.ts   → BIBLIO_PERMISSION et UI_TEXT (pour afficher les
//     messages d'erreur toast, ui.errXxx)
//   - components/FormatPanel.tsx, FormatEditDialog.tsx → FORMAT_LABELS,
//     FORMAT_CHANNELS, iconPath (liste des onglets de canaux)
//   - components/QRFormDialog.tsx, ThematiqueFormDialog.tsx, BriefChiffresDialogs.tsx
//     → UI_TEXT directement (les autres composants reçoivent déjà les textes "ui"
//     via BiblioContext, sans avoir besoin d'importer ce fichier)
//   - Fichiers de test         → pour vérifier les textes affichés dans les tests

import type { FormatChannel } from "./types"

// Codes de permission de la feature, sur le modèle de WIKI_PERMISSION.
// `view` gate l'accès à la route (router.tsx + menuItems.ts) ; `manage`
// autorise création/modification/suppression. Les deux sont appliquées côté
// base par les RLS (20260715130000_bibliotheque_manage_permission.sql, puis
// 20260720120000_bibliotheque_manage_restrict_tech.sql) : le front ne fait
// que masquer ce qui serait de toute façon refusé par PostgreSQL.
export const BIBLIO_PERMISSION = {
    view: "bibliotheque.view",
    manage: "bibliotheque.manage",
} as const

// fr est la langue de référence dont le type est extrait.
// UI_TEXT.en satisfies ce type à la compilation : tout ajout dans fr sans
// contrepartie dans en lève immédiatement une erreur TypeScript.
const fr = {
    langFr: "Français",
    langEn: "Anglais",
    langSelectorLabel: "Langue",
    topics: "Thématiques",
    newTopic: "Nouvelle thématique",
    loadingText: "Chargement…",
    loadErrorTitle: "Impossible de charger la bibliothèque.",
    loadErrorHint: "Vérifiez votre connexion et réessayez.",
    retry: "Réessayer",
    noTopics: "Aucune thématique pour l'instant.",
    noTopicsHint: "Créez votre première thématique pour commencer.",
    qrSection: "Questions / Réponses",
    addQuestion: "Nouvelle question",
    briefTitle: "Brief — Règles d'or",
    briefNav: "Brief Général",
    searchPlaceholder: "Rechercher une thématique ou une question...",
    clearSearch: "Effacer la recherche",
    saving: "Enregistrement…",
    deleting: "Suppression…",
    noQuestions: "Aucune question pour cette thématique.",
    addFirstQuestion: "Ajouter la première question",
    selectQuestionLine1: "Sélectionnez une question",
    selectQuestionLine2: "pour afficher le détail.",
    viewTopic: "Voir la thématique",
    back: "Retour",
    // Fonction : retourne un message incluant le terme recherché
    noResults: (q: string) => `Aucun résultat pour « ${q} »`,
    format: "Formats Réponses",
    newQuestion: "Nouvelle question (FR + EN exigés)",
    editQuestion: "Modifier la question (FR + EN exigés)",
    thematiqueLabel: "Thématique",
    questionLabel: "Question",
    questionPlaceholder: "Saisissez la question...",
    reponseLabel: "Brief de la question",
    reponsePlaceholder: "Saisissez le brief...",
    cancel: "Annuler",
    save: "Enregistrer",
    add: "Ajouter",
    deleteQuestion: "Supprimer la question",
    // Fonction : retourne un message de confirmation incluant le texte de la question
    deleteQuestionConfirm: (q: string) => `Supprimer « ${q} » ? Cette action est irréversible.`,
    delete: "Supprimer",
    newTopicTitle: "Nouvelle thématique (FR + EN exigés)",
    renameTopic: "Renommer la thématique (FR + EN exigés)",
    topicNameLabel: "Nom de la thématique",
    topicNamePlaceholder: "Ex : Délais de livraison",
    topicImageLabel: "Image - 500 Ko max",
    topicImageChoose: "Choisir une image…",
    topicIconLabel: "Icône (SVG) - 500 Ko max",
    topicIconChoose: "Choisir un fichier SVG…",
    topicMediaNameRequired: "Renseignez d'abord le nom (FR) de la thématique",
    uploading: "Téléversement…",
    errUploadImage: "Impossible de téléverser l'image",
    errUploadIcon: "Impossible de téléverser l'icône",
    errInvalidImage: "Le fichier doit être une image PNG, JPEG ou WebP",
    errInvalidIcon: "Le fichier doit être au format SVG",
    errUnsafeIcon: "Ce fichier SVG contient du contenu non autorisé (script, gestionnaire d'événement…)",
    // Fonction : message avec la limite (en Mo) incluse
    errFileTooLarge: (maxMb: number) => `Le fichier dépasse la taille maximale autorisée (${maxMb} Mo)`,
    rename: "Renommer",
    create: "Créer",
    deleteTopic: "Supprimer la thématique",
    deleteTopicConfirm: (label: string) => `Supprimer « ${label} » ?`,
    // Fonction : avertissement avec accord grammatical automatique selon le nombre
    // `condition ? valeurSiVrai : valeurSiFaux` est l'opérateur ternaire : une
    // écriture compacte d'un if/else qui renvoie directement une valeur.
    // Ici, `n > 1 ? "s" : ""` ajoute un "s" seulement si n est supérieur à 1.
    deleteTopicWarning: (n: number) =>
        `⚠️ ${n} question${n > 1 ? "s" : ""} associée${n > 1 ? "s" : ""} sera${n > 1 ? "ont" : ""} également supprimée${n > 1 ? "s" : ""}.`,
    editBriefTitle: "Modifier le brief — Règles d'or (FR + EN exigés)",
    editChiffresTitle: "Modifier les chiffres de référence (FR + EN exigés)",
    briefPlaceholder: "Rédigez le brief en français...",
    noBrief: "Aucun brief rédigé pour l'instant.",
    chiffresTitle: "Chiffres de référence",
    chiffresPlaceholder: "Saisissez les chiffres de référence en français...",
    noChiffres: "Aucun chiffre de référence pour l'instant.",
    editFormatsTitle: "Modifier les formats de réponse (FR + EN exigés)",
    noFormatted: "Aucune réponse formatée. Cliquez sur « Modifier » pour en ajouter.",
    noFormattedReadOnly: "Aucune réponse formatée.",
    edit: "Modifier",
    copy: "Copier",
    copied: "Copié !",
    showMore: "Voir plus",
    showLess: "Voir moins",
    // Fonction : accord pluriel automatique
    results: (n: number) => `${n} résultat${n > 1 ? "s" : ""}`,
    paginationPrevious: "Précédent",
    paginationNext: "Suivant",
    // Fonction : indicateur de page courante / nombre total de pages
    paginationPageOf: (page: number, total: number) => `Page ${page} / ${total}`,
    sectionFr: "🇫🇷 Français",
    sectionEn: "🇬🇧 Anglais",
    errLoad: "Erreur lors du chargement de la bibliothèque",
    errCreateTopic: "Impossible de créer la thématique",
    errRenameTopic: "Impossible de renommer la thématique",
    errSaveBrief: "Impossible de sauvegarder le brief",
    errSaveChiffres: "Impossible de sauvegarder les chiffres",
    errDeleteTopic: "Impossible de supprimer la thématique",
    errCreateQR: "Impossible d'ajouter la question",
    errUpdateQR: "Impossible de modifier la question",
    errDeleteQR: "Impossible de supprimer la question",
    errSaveFormats: "Impossible de sauvegarder les formats",
    errCopy: "Impossible de copier dans le presse-papiers",
    // Conseils de rédaction affichés dans l'éditeur de format, par canal
    formatHints: {
        email: "Formel, structuré, formules de politesse",
        instagram: "Ton complice, court, vivant",
        whatsapp: "Direct, orienté action, conversion",
    },
}

// UI est le type des textes pour UNE langue (fr ou en).
// Dérivé de fr — source unique de vérité pour la forme des traductions.
export type UI = typeof fr

export const UI_TEXT = {
    fr,
    en: {
        langFr: "French",
        langEn: "English",
        langSelectorLabel: "Language",
        topics: "Topics",
        newTopic: "New topic",
        loadingText: "Loading…",
        loadErrorTitle: "Unable to load the library.",
        loadErrorHint: "Check your connection and try again.",
        retry: "Retry",
        noTopics: "No topics yet.",
        noTopicsHint: "Create your first topic to get started.",
        qrSection: "Questions & Answers",
        addQuestion: "New question",
        briefTitle: "Brief — Golden rules",
        briefNav: "General Brief",
        searchPlaceholder: "Search a topic or a question...",
        clearSearch: "Clear search",
        saving: "Saving…",
        deleting: "Deleting…",
        noQuestions: "No questions for this topic.",
        addFirstQuestion: "Add the first question",
        selectQuestionLine1: "Select a question",
        selectQuestionLine2: "to view its details.",
        viewTopic: "View topic",
        back: "Back",
        noResults: (q: string) => `No results for "${q}"`,
        format: "Reply Formats",
        newQuestion: "New question (FR + EN required)",
        editQuestion: "Edit question (FR + EN required)",
        thematiqueLabel: "Topic",
        questionLabel: "Question",
        questionPlaceholder: "Enter the question...",
        reponseLabel: "Brief of the question",
        reponsePlaceholder: "Enter the brief...",
        cancel: "Cancel",
        save: "Save",
        add: "Add",
        deleteQuestion: "Delete question",
        deleteQuestionConfirm: (q: string) => `Delete "${q}"? This action cannot be undone.`,
        delete: "Delete",
        newTopicTitle: "New topic (FR + EN required)",
        renameTopic: "Rename topic (FR + EN required)",
        topicNameLabel: "Topic name",
        topicNamePlaceholder: "E.g.: Delivery times",
        topicImageLabel: "Image - 500 Kb max",
        topicImageChoose: "Choose an image…",
        topicIconLabel: "Icon (SVG) - 500 Kb max",
        topicIconChoose: "Choose an SVG file…",
        topicMediaNameRequired: "Enter the topic's name (FR) first",
        uploading: "Uploading…",
        errUploadImage: "Unable to upload the image",
        errUploadIcon: "Unable to upload the icon",
        errInvalidImage: "The file must be a PNG, JPEG or WebP image",
        errInvalidIcon: "The file must be an SVG",
        errUnsafeIcon: "This SVG file contains disallowed content (script, event handler…)",
        errFileTooLarge: (maxMb: number) => `The file exceeds the maximum allowed size (${maxMb} MB)`,
        rename: "Rename",
        create: "Create",
        deleteTopic: "Delete topic",
        deleteTopicConfirm: (label: string) => `Delete "${label}"?`,
        deleteTopicWarning: (n: number) =>
            `⚠️ ${n} associated question${n > 1 ? "s" : ""} will also be deleted.`,
        editBriefTitle: "Edit brief — Golden rules",
        editChiffresTitle: "Edit reference figures",
        briefPlaceholder: "Write the brief in English...",
        noBrief: "No brief written yet.",
        chiffresTitle: "Reference figures",
        chiffresPlaceholder: "Enter the reference figures in English...",
        noChiffres: "No reference figures yet.",
        editFormatsTitle: "Edit response formats (FR + EN required)",
        noFormatted: "No formatted response. Click \"Edit\" to add one.",
        noFormattedReadOnly: "No formatted response.",
        edit: "Edit",
        copy: "Copy",
        copied: "Copied!",
        showMore: "See more",
        showLess: "See less",
        results: (n: number) => `${n} result${n > 1 ? "s" : ""}`,
        paginationPrevious: "Previous",
        paginationNext: "Next",
        paginationPageOf: (page: number, total: number) => `Page ${page} of ${total}`,
        sectionFr: "🇫🇷 French",
        sectionEn: "🇬🇧 English",
        errLoad: "Error loading the library",
        errCreateTopic: "Unable to create topic",
        errRenameTopic: "Unable to rename topic",
        errSaveBrief: "Unable to save brief",
        errSaveChiffres: "Unable to save reference figures",
        errDeleteTopic: "Unable to delete topic",
        errCreateQR: "Unable to add question",
        errUpdateQR: "Unable to update question",
        errDeleteQR: "Unable to delete question",
        errSaveFormats: "Unable to save formats",
        errCopy: "Unable to copy to clipboard",
        formatHints: {
            email: "Formal, structured, polite phrasing",
            instagram: "Casual tone, short, lively",
            whatsapp: "Direct, action-oriented, conversion",
        },
    } satisfies UI,
}

// Libellés affichés sur les onglets de canaux dans l'interface
export const FORMAT_LABELS = {
    email: "Email",
    instagram: "DM Instagram",
    whatsapp: "WhatsApp",
} as const  // "as const" empêche TypeScript d'élargir les types à "string"

// Fonction fléchée (arrow function) sans accolades : quand le corps tient en
// une seule expression, `(ch) => expression` la calcule et la retourne
// directement, sans avoir besoin d'écrire `{ return expression }`.
// `${ch}` dans les backticks (template literal) insère la valeur de `ch`
// directement dans la chaîne de caractères.
export const iconPath = (ch: FormatChannel) => `/bibliotheque/icons/${ch}.svg`

// Tableau des clés de FORMAT_LABELS, utilisé pour itérer sur les onglets.
// Object.keys() retourne string[] par défaut ; le cast "as FormatChannel[]"
// indique à TypeScript que ces clés sont exactement notre type FormatChannel.
export const FORMAT_CHANNELS = Object.keys(FORMAT_LABELS) as FormatChannel[]
