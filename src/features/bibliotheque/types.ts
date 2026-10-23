// ── types.ts ──────────────────────────────────────────────────────────────────
// RÔLE : Définit les types TypeScript partagés dans toute la feature Bibliothèque.
//
// Un "type" ou "interface" est un contrat : il décrit la forme exacte qu'un
// objet doit avoir (quels champs, de quel type). TypeScript vérifie à la
// compilation que le code respecte ces contrats — si tu passes un mauvais objet
// quelque part, TypeScript te le signale avant même que l'appli soit lancée.
//
// CE FICHIER EST IMPORTÉ PAR :
//   - services/mappers.ts      → pour typer les objets métier en sortie de mapping
//   - services/bibliothequeService.ts → pour typer les paramètres des fonctions CRUD
//   - hooks/data/useBibli.ts  → pour typer l'état React (useState)
//   - hooks/useDialog.ts       → pour typer les payloads des dialogs (QR, Thematique)
//   - hooks/useSearch.ts       → pour typer les résultats de recherche
//   - hooks/useBiblioPage.ts   → pour typer les paramètres des handlers
//   - utils.tsx                → pour typer les paramètres des fonctions utilitaires
//   - Quasiment tous les composants → pour annoter leurs props et variables locales

// Ce fichier utilise deux mots-clés TypeScript pour décrire des formes de
// données : `type` (souvent pour une union de valeurs possibles, comme
// Lang ci-dessous, ou un alias vers un autre type) et `interface` (pour la
// forme d'un objet, avec ses champs). Dans ce fichier, les deux sont
// interchangeables pour les objets ; c'est surtout une question de convention.

// Les deux langues supportées. Le type union "fr" | "en" garantit qu'on ne
// peut jamais passer une chaîne invalide comme "de" ou "es".
export type Lang = "fr" | "en"

// Les trois canaux de diffusion disponibles pour les réponses formatées.
export type FormatChannel = "email" | "instagram" | "whatsapp"

// Une thématique = une catégorie de questions (ex : "Délais de livraison").
// Chaque champ est présent en français ET en anglais pour le mode bilingue.
export interface Thematique {
    id: string        // identifiant unique (UUID généré par Supabase)
    label: string     // nom de la thématique en français
    labelEn: string   // nom de la thématique en anglais
    imageUrl: string  // chemin vers l'image illustrant la thématique (ex : /bibliotheque/mon-image.jpg)
    iconUrl: string   // chemin vers l'icône SVG affichée dans la sidebar (ex : /bibliotheque/icons/livraison.svg)
}

// Le brief global unique de la Bibliothèque (règles d'or communes à toutes les thématiques).
// Une seule instance existe en base (table bibliotheque_brief, id = 1).
export interface Brief {
    brief: string
    briefEn: string
    chiffres: string
    chiffresEn: string
}

// Une paire Question / Réponse, rattachée à une thématique via thematiqueId.
export interface QR {
    id: string
    thematiqueId: string  // référence l'id de la Thematique parente
    question: string
    questionEn: string
    // briefQr/briefQrEn : le texte de la réponse. Nommé "brief" en base et dans
    // le code (pas "reponse") car c'est un résumé à suivre, pas une réponse mot
    // pour mot — voir la fonction tReponse() dans utils.tsx qui lit ces champs.
    briefQr: string
    briefQrEn: string
}

// QRContent = QR sans les champs gérés automatiquement (id et thematiqueId).
// Omit<T, K> est un utilitaire TypeScript : il produit un nouveau type à partir
// de T en excluant les clés listées dans K. Utilisé pour les formulaires de
// création/édition où on ne saisit que le contenu.
export type QRContent = Omit<QR, "id" | "thematiqueId">

// FormatMap = les réponses adaptées à chaque canal de diffusion, en FR et EN.
// Chaque canal a deux champs : la version française (ex. email) et la version
// anglaise (ex. emailEn). Les clés FR correspondent exactement à FormatChannel
// pour permettre l'indexation directe map[ch].
export interface FormatMap {
    email: string
    emailEn: string
    instagram: string
    instagramEn: string
    whatsapp: string
    whatsappEn: string
}

// Un groupe de résultats de recherche : la thématique parente + ses Q&R
// correspondantes + un booléen indiquant si la thématique elle-même matche.
export interface SearchGroup {
    thematique: Thematique
    questionsReponses: QR[]
    isThematiqueMatch: boolean  // true si le nom de la thématique contient le terme cherché
}
