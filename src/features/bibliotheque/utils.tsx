// ── utils.tsx ─────────────────────────────────────────────────────────────────
// RÔLE : Fonctions utilitaires "pures" partagées dans toute la feature.
//
// "Pure" signifie qu'une fonction ne modifie rien en dehors d'elle-même :
// elle reçoit des paramètres, calcule un résultat et le retourne — c'est tout.
// Pas d'état React, pas d'appel réseau, pas d'effets de bord. Elles sont donc
// très faciles à tester et à réutiliser.
//
// Contenu :
//   - highlight()  : surligne un terme dans du texte (retourne du JSX avec <mark>)
//   - tLabel()     : nom d'une thématique dans la langue active (fr ou en)
//   - tQuestion()  : texte d'une question dans la langue active
//   - tReponse()   : texte d'une réponse dans la langue active
//   - tFormat()    : texte d'un canal de format dans la langue active
//   - slugify()    : normalise un texte en identifiant de fichier (minuscules,
//                    sans accents ni caractères spéciaux)
//   - hasUnsafeSvgContent() : détecte un contenu SVG potentiellement dangereux
//                    avant upload (mitigation XSS best-effort côté client)
//
// Pourquoi .tsx et pas .ts ? Parce que highlight() retourne des éléments JSX
// (la balise <mark>). TypeScript n'autorise le JSX que dans les fichiers .tsx.
//
// CE FICHIER EST IMPORTÉ PAR :
//   - hooks/useSearch.ts        → tLabel, tQuestion, tReponse (pour filtrer)
//   - services/bibliothequeMediaService.ts → slugify (nom de fichier des médias uploadés)
//   - components/BiblioSidebar.tsx → tLabel (affichage du nom de thématique)
//   - components/BiblioMainColumn.tsx → tLabel
//   - components/QRCard.tsx     → tQuestion, tReponse
//   - components/QRDetailPanel.tsx → tLabel, tQuestion, tReponse, highlight
//   - components/SearchResults.tsx → tLabel, tQuestion, highlight
//   - components/DeleteDialogs.tsx → tQuestion, tLabel
//   - components/QRFormDialog.tsx → tLabel
//   - components/FormatPanel.tsx  → tFormat
//   - components/FormatViewDialog.tsx → tQuestion
//   - components/FormatEditDialog.tsx → tQuestion
//   - components/ThematiqueFormDialog.tsx → hasUnsafeSvgContent (validation de l'icône SVG uploadée)

import DOMPurify from "dompurify"
import type { ReactNode } from "react"
import type { Lang, Thematique, QR, FormatMap, FormatChannel } from "./types"

// Surligne les occurrences de `query` dans `text` en les enveloppant dans une
// balise <mark> stylisée. Utilisé dans les résultats de recherche.
// Retourne ReactNode et non string car React peut afficher un tableau mixte
// de chaînes et d'éléments JSX.
export function highlight(text: string, query: string): ReactNode {
    // Si la recherche est vide, on retourne le texte brut sans modification
    if (!query.trim()) return text

    // On "escape" les caractères spéciaux regex pour éviter des erreurs si
    // l'utilisateur tape par exemple "(" ou "." dans la barre de recherche
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

    // On découpe le texte en gardant les séparateurs grâce aux parenthèses
    // capturantes dans le regex. Ex : "livraison rapide" avec query "rap"
    // donne ["livraison ", "rap", "ide"]
    const parts = text.split(new RegExp(`(${escaped})`, "gi"))

    // Clé stable : la position (offset en caractères) du fragment dans le texte
    // source. Deux occurrences surlignées ne peuvent pas partager le même offset,
    // et la clé reste identique tant que le couple (text, query) ne change pas.
    let offset = 0
    return parts.map((part) => {
        const start = offset
        offset += part.length
        return part.toLowerCase() === query.toLowerCase()
            ? <mark key={start} className="bg-brand-light text-brand rounded-sm px-0.5 not-italic">{part}</mark>
            : part
    })
}

// Les quatre fonctions suivantes extraient le champ dans la bonne langue.
// Elles centralisent la logique "fr ou en ?" pour ne pas la répéter partout.

// Retourne le nom de la thématique dans la langue active
export function tLabel(t: Thematique, lang: Lang) { return lang === "fr" ? t.label : t.labelEn }

// Retourne le texte de la question dans la langue active
export function tQuestion(qr: QR, lang: Lang) { return lang === "fr" ? qr.question : qr.questionEn }

// Retourne le texte de la réponse dans la langue active
export function tReponse(qr: QR, lang: Lang) { return lang === "fr" ? qr.briefQr : qr.briefQrEn }

// Retourne le format d'un canal dans la langue active.
// En FR : map[ch] (email | instagram | whatsapp)
// En EN : map[chEn] (emailEn | instagramEn | whatsappEn)
// `keyof FormatMap` est un type généré automatiquement par TypeScript : c'est
// l'union de tous les noms de propriétés de FormatMap ("email" | "emailEn" |
// "instagram" | ...). On construit le nom "emailEn" à l'exécution avec un
// template literal, puis on dit à TypeScript "fais-moi confiance, cette
// chaîne est bien une des clés valides de FormatMap" via `as keyof FormatMap`.
export function tFormat(map: FormatMap, ch: FormatChannel, lang: Lang): string {
    return lang === "fr" ? map[ch] : map[`${ch}En` as keyof FormatMap]
}

// Normalise un texte libre (ex: le nom d'une thématique) en un identifiant
// utilisable comme nom de fichier : minuscules, accents retirés, tout ce qui
// n'est pas [a-z0-9] remplacé par un tiret, tirets superflus nettoyés.
// Ex : "Délais de livraison !" → "delais-de-livraison"
export function slugify(text: string): string {
    return text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // retire les accents laisses par normalize("NFD") (e accentue -> e, c cedille -> c...)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
}

// Nettoie un SVG avant son upload et renvoie le contenu assaini, ou null si le
// fichier est irrécupérable (à rejeter avec un message à l'utilisateur).
//
// C'est le contenu RETOURNÉ qui part vers Storage, jamais le fichier choisi :
// une blocklist se contourne (une balise oubliée, un encodage exotique), une
// allowlist ne laisse passer que ce qu'elle connaît. DOMPurify tient cette
// allowlist à jour, ce qu'une regex maison ne fera jamais.
//
// Vecteurs fermés :
//   - XSS stocké et inline : <script>, <foreignObject>, attributs "on*",
//     URI "javascript:" — retirés par le profil SVG de DOMPurify.
//   - Fuite de données / SSRF : <image href="http://…">, <use>, @font-face via
//     <style>. Une icône de sidebar affichée en masque CSS n'a aucun besoin de
//     référence externe, donc on les interdit en bloc plutôt que de tenter de
//     distinguer les URL acceptables.
//   - XXE et « billion laughs » : toute DTD est refusée avant le parse, donc
//     aucune entité n'est jamais expansée.
//
// Reste hors de portée du client : les en-têtes de service des fichiers
// (Content-Disposition, CSP, nosniff) et l'origine qui les sert — voir le
// reverse proxy devant Storage.
export function sanitizeSvgText(svgText: string): string | null {
    // Avant tout parse : une DTD interne récursive fait exploser la mémoire du
    // parseur lui-même, donc il est trop tard pour filtrer après coup.
    if (/<!(DOCTYPE|ENTITY)/i.test(svgText)) return null

    const clean = DOMPurify.sanitize(svgText, {
        USE_PROFILES: { svg: true, svgFilters: true },
        // Le SVG est un fichier autonome, pas un fragment de page : sans ce
        // média type, le parse passe par HTML et le namespace SVG est perdu.
        PARSER_MEDIA_TYPE: "image/svg+xml",
        FORBID_TAGS: ["script", "foreignObject", "iframe", "image", "use", "style"],
        FORBID_ATTR: ["href", "xlink:href"],
    })

    // Un fichier qui n'était pas un SVG n'a pas de racine <svg> : rien à
    // téléverser. DOMPurify rattrape aussi le XML malformé en le réduisant à un
    // <svg> vide — sans enfant, c'est soit un fichier cassé, soit un fichier
    // dont TOUT le contenu vient d'être retiré : dans les deux cas on rejette,
    // plutôt que de téléverser une icône invisible sans rien dire.
    const doc = new DOMParser().parseFromString(clean, "image/svg+xml")
    if (doc.querySelector("parsererror")) return null
    const root = doc.documentElement
    if (root?.nodeName.toLowerCase() !== "svg") return null
    if (root.children.length === 0) return null

    return clean
}
