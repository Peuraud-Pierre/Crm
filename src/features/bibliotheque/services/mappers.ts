// ── services/mappers.ts ───────────────────────────────────────────────────────
// RÔLE : Transforme les données brutes de la base de données en objets
// utilisables par l'interface.
//
// Supabase retourne les données au format de la base de données :
//   - noms de colonnes en snake_case (ex: label_en, image_url, brief_qr)
//   - valeurs potentiellement null pour les colonnes optionnelles
//
// Les composants React attendent des objets métier propres :
//   - noms de propriétés en camelCase (ex: labelEn, imageUrl, briefQr)
//   - valeurs toujours des chaînes (jamais null)
//
// Ces fonctions font cette conversion. Ce sont des fonctions pures (aucun effet
// de bord), ce qui les rend très simples à tester.
//
// TABLE_NAMES : centralise les noms exacts des tables Supabase pour éviter
// les fautes de frappe éparpillées dans le code.
//
// CE FICHIER EST IMPORTÉ PAR :
//   - services/bibliothequeService.ts       → utilise TABLE_NAMES pour les requêtes
//   - hooks/data/useBibli.ts         → utilise les fonctions map* pour convertir
//                                             les données reçues de Supabase
//   - hooks/data/useBiblioRealtime.ts → idem, pour les payloads Realtime

import { z } from "zod"
import type { Database } from "@/integrations/supabase/types"
import type { Thematique, QR, FormatMap, Brief } from "../types"

// Formes des lignes Supabase (snake_case), dérivées des types générés —
// ex-db.ts (voir git blame) : ce fichier déclarait ces formes à la main tant
// que `supabase gen types` n'avait pas rattrapé les migrations bibliotheque_*
// (colonnes brief_qr/image_url.../table bibliotheque_brief séparée). C'est
// désormais le cas (db.test.ts servait de garde-fou compile-time pour ce
// jour précis), donc on lit directement dans le type généré.
export type ThematiqueRow = Database["public"]["Tables"]["bibliotheque_thematiques"]["Row"]
export type QRRow = Database["public"]["Tables"]["bibliotheque_questions_reponses"]["Row"]
export type FormatRow = Database["public"]["Tables"]["bibliotheque_format_reponses"]["Row"]
export type BriefRow = Database["public"]["Tables"]["bibliotheque_brief"]["Row"]

// Noms des tables Supabase utilisés dans toutes les requêtes.
// "as const" indique à TypeScript que ces chaînes ne changeront jamais —
// cela permet d'inférer le type précis ("bibliotheque_thematiques") au lieu
// du type générique (string).
export const TABLE_NAMES = {
    thematiques: "bibliotheque_thematiques",
    questionsReponses: "bibliotheque_questions_reponses",
    formatReponses: "bibliotheque_format_reponses",
    brief: "bibliotheque_brief",
} as const

// ── Payloads Realtime ─────────────────────────────────────────────────────────
// Supabase envoie `new` sur INSERT/UPDATE et `old` sur DELETE. Le contenu de
// `old` dépend de la REPLICA IDENTITY Postgres de la table :
//   - DEFAULT (la plupart des tables) → seule la clé primaire est présente.
//   - FULL (voir bibliotheque_format_reponses, migration
//     20260716120000_bibliotheque_realtime.sql) → toutes les colonnes de
//     l'ancienne ligne sont présentes.
// D'où le typage `Partial<T>` : `old` n'est jamais garanti complet. Utilisé
// par bibliothequeService.ts (souscription) et useBiblioRealtime.ts (callbacks).
export type RealtimePayload<T> = {
    new: T | Record<string, never>
    old: Partial<T>
}

// Le payload brut d'un événement Realtime n'est pas garanti par le
// compilateur (donnée réseau, forme non vérifiée par le SDK) : useBiblioRealtime.ts
// valide donc chaque payload avec ces schémas avant de le caster vers le Row
// correspondant. Seuls les champs effectivement lus par mappers.ts /
// useBiblioRealtime.ts sont requis ici — les autres colonnes ne sont pas
// vérifiées (mappers.ts les coalesce déjà avec `?? ""`, donc leur absence ne
// casse rien à l'usage).
export const thematiqueRowSchema = z.object({
    id: z.string(),
    label: z.string(),
    position: z.number(),
})

export const qrRowSchema = z.object({
    id: z.string(),
    thematique_id: z.string(),
    question: z.string(),
    brief_qr: z.string(),
    position: z.number(),
})

export const formatRowSchema = z.object({
    id: z.string(),
    quest_rep_id: z.string(),
})

export const briefRowSchema = z.object({
    id: z.number(),
})

// Formes minimales de `payload.old` : seule la clé effectivement lue (id, ou
// quest_rep_id pour le cas FULL REPLICA IDENTITY de bibliotheque_format_reponses)
// est requise.
export const rowIdSchema = z.object({ id: z.string() })
export const formatRowOldSchema = z.object({ quest_rep_id: z.string().optional() })

// Convertit une ligne de la table bibliotheque_thematiques en objet Thematique.
// L'opérateur ?? "" signifie : "si la valeur est null ou undefined, utilise ""
// à la place". Cela garantit que les propriétés sont toujours des chaînes.
export function mapThematique(row: ThematiqueRow): Thematique {
    return {
        id: row.id,
        label: row.label,
        labelEn: row.label_en ?? "",       // null en base → "" dans l'appli
        imageUrl: row.image_url ?? "",     // null en base → "" dans l'appli
        iconUrl: row.icon_url ?? "",       // null en base → "" dans l'appli
    }
}

// Convertit une ligne de la table bibliotheque_questions_reponses en objet QR.
export function mapQR(row: QRRow): QR {
    return {
        id: row.id,
        thematiqueId: row.thematique_id,   // snake_case → camelCase
        question: row.question,
        questionEn: row.question_en ?? "",
        briefQr: row.brief_qr,
        briefQrEn: row.brief_qr_en ?? "",
    }
}

// Convertit une ligne de la table bibliotheque_format_reponses.
// Retourne un tuple (tableau de deux éléments) : [identifiant de la Q&R, objet FormatMap].
// Ce format facilite la construction du dictionnaire formatReponses dans useBibli :
//   const [qrId, fmt] = mapFormatRow(row)
//   dict[qrId] = fmt
export function mapFormatRow(row: FormatRow): [string, FormatMap] {
    return [row.quest_rep_id, {
        email: row.email ?? "",
        emailEn: row.email_en ?? "",
        instagram: row.instagram ?? "",
        instagramEn: row.instagram_en ?? "",
        whatsapp: row.whatsapp ?? "",
        whatsappEn: row.whatsapp_en ?? "",
    }]
}

// Convertit la ligne singleton de la table bibliotheque_brief en objet Brief.
// "Singleton" = il n'existe qu'une seule ligne dans cette table (id = 1).
export function mapBriefRow(row: BriefRow): Brief {
    return {
        brief: row.brief ?? "",
        briefEn: row.brief_en ?? "",
        chiffres: row.chiffres ?? "",
        chiffresEn: row.chiffres_en ?? "",
    }
}
