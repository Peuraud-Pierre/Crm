// ── services/bibliothequeService.ts ───────────────────────────────────────────
// RÔLE : Couche service — CRUD des 4 tables Supabase de la feature Bibliothèque.
//
// Principe de séparation des responsabilités :
//   Ce fichier ne sait rien de React (pas de useState, pas d'effets).
//   Il ne sait pas non plus afficher de messages (pas de toast).
//   Son seul travail : envoyer des requêtes SQL à Supabase et retourner
//   le résultat, ou lancer une erreur si la requête échoue.
//   C'est le hook useBibli.ts qui appelle ces fonctions et gère la suite.
//
// Tout ce qui touche Supabase Storage (upload/renommage/suppression de
// médias) vit dans services/bibliothequeMediaService.ts — extrait de ce
// fichier pour rester sous le seuil de 400 lignes (Architecture_Feature.pdf
// §15). insertThematiqueWithMediaRetry / patchThematiqueWithMediaRetry
// orchestrent la couche médias avec ce fichier : elles écrivent la ligne
// thématique et, si l'écriture est rejetée par l'un des index UNIQUE partiels
// posés sur image_url/icon_url (migration
// 20260720130000_bibliotheque_thematiques_media_unique.sql), déplacent le
// média déjà téléversé vers un chemin libre puis retentent — voir
// services/bibliothequeMediaConflict.ts (detectMediaConflict/
// relocateThematiqueMedia) pour le détail du garde-fou d'atomicité.
//
// Opérations disponibles :
//   - fetchAllBiblioData() : charge toutes les données au démarrage (4 tables)
//   - insertThematique / patchThematique / removeThematique : CRUD thématiques
//   - insertThematiqueWithMediaRetry / patchThematiqueWithMediaRetry :
//     variantes utilisées par useBibli.ts, avec retry atomique sur conflit média
//   - upsertBrief / upsertChiffres : mise à jour du brief global
//   - insertQR / patchQR / removeQR : CRUD questions-réponses
//   - upsertFormatMap : mise à jour des formats de réponse d'une Q&R
//
// "upsert" = INSERT si la ligne n'existe pas, UPDATE si elle existe déjà.
//
// CE FICHIER EST IMPORTÉ PAR :
//   - hooks/data/useBibli.ts → seul consommateur de ce service

import { supabase as db } from "@/integrations/supabase/client"
import { TABLE_NAMES } from "./mappers"
import * as mediaConflict from "./bibliothequeMediaConflict"
import { throwIfError } from "./errors"
import type { ThematiqueRow, QRRow, FormatRow, BriefRow, RealtimePayload } from "./mappers"
import type { QRContent, FormatMap } from "../types"

// ── Fetch initial ──────────────────────────────────────────────────────────────

export interface FetchAllResult {
    thematiques: ThematiqueRow[]
    questionsReponses: QRRow[]
    formatReponses: FormatRow[]
    brief: BriefRow | null
}

// Charge toutes les données de la Bibliothèque en une seule fois au démarrage.
// Promise.all() lance les 4 requêtes EN PARALLÈLE (simultanément) pour aller
// plus vite qu'en les faisant l'une après l'autre.
export async function fetchAllBiblioData(): Promise<FetchAllResult> {
    // Destructuring de tableau : Promise.all() renvoie un tableau des 4
    // résultats DANS L'ORDRE où les promesses ont été passées (pas dans
    // l'ordre où elles se terminent). `const [tRes, qRes, fRes, bRes] = ...`
    // extrait donc chaque résultat dans une variable nommée en une seule ligne.
    const [tRes, qRes, fRes, bRes] = await Promise.all([
        // Les thématiques, triées par position puis par date de création
        db.from(TABLE_NAMES.thematiques).select("*")
            .order("position", { ascending: true })
            .order("created_at", { ascending: true }),
        // Les questions/réponses, triées par position puis par date de création
        db.from(TABLE_NAMES.questionsReponses).select("*")
            .order("position", { ascending: true })
            .order("created_at", { ascending: true }),
        // Les formats de réponse (pas de tri nécessaire — on les indexe par qrId)
        db.from(TABLE_NAMES.formatReponses).select("*"),
        // Le brief global — .single() retourne un objet au lieu d'un tableau
        // car on sait qu'il n'y a qu'une seule ligne (id = 1)
        db.from(TABLE_NAMES.brief).select("*").single(),
    ])

    // Si une requête échoue, on lève une erreur pour que useBibli l'intercepte
    throwIfError("fetchAllBiblioData:thematiques", tRes.error)
    throwIfError("fetchAllBiblioData:questionsReponses", qRes.error)
    throwIfError("fetchAllBiblioData:formatReponses", fRes.error)
    // PGRST116 = code Supabase signifiant "0 lignes trouvées pour .single()"
    // C'est normal si le brief n'a jamais été créé — on ignore cette erreur-là
    if (bRes.error && bRes.error.code !== "PGRST116") throwIfError("fetchAllBiblioData:brief", bRes.error)

    return {
        thematiques: (tRes.data ?? []) as unknown as ThematiqueRow[],
        questionsReponses: (qRes.data ?? []) as unknown as QRRow[],
        formatReponses: (fRes.data ?? []) as unknown as FormatRow[],
        brief: bRes.data as unknown as BriefRow | null,
    }
}

// ── Thématiques ────────────────────────────────────────────────────────────────
// Chaque fonction correspond à une opération SQL :
//   insertThematique → INSERT INTO bibliotheque_thematiques ...
//   patchThematique  → UPDATE bibliotheque_thematiques SET ... WHERE id = ...
//   removeThematique → DELETE FROM bibliotheque_thematiques WHERE id = ...

export async function insertThematique(
    label: string,
    labelEn: string,
    imageUrl: string,
    iconUrl: string,
    position: number,
    userId: string,
): Promise<ThematiqueRow> {
    const { data, error } = await db
        .from(TABLE_NAMES.thematiques)
        .insert([{ label, label_en: labelEn, image_url: imageUrl, icon_url: iconUrl, position, created_by: userId }])
        .select("*")
        .single()
    throwIfError("insertThematique", error)
    return data as unknown as ThematiqueRow
}

export async function patchThematique(
    id: string,
    label: string,
    labelEn: string,
    imageUrl: string,
    iconUrl: string,
): Promise<void> {
    const { error } = await db
        .from(TABLE_NAMES.thematiques)
        .update({ label, label_en: labelEn, image_url: imageUrl, icon_url: iconUrl })
        .eq("id", id)
    throwIfError("patchThematique", error)
}

export async function removeThematique(id: string): Promise<void> {
    const { error } = await db.from(TABLE_NAMES.thematiques).delete().eq("id", id)
    throwIfError("removeThematique", error)
}

// ── Écriture thématique avec retry atomique sur conflit média ────────────────
//
// insertThematique/patchThematique ci-dessus peuvent être rejetées par l'un
// des index UNIQUE partiels sur image_url/icon_url (violation 23505) si le
// pré-check best-effort de bibliothequeMediaService (SELECT avant upload/
// déplacement, non-atomique — voir son commentaire) a laissé passer deux
// écritures concurrentes vers le même chemin. C'est rare (il faut deux
// utilisateurs qui créent/renomment une thématique vers le même nom au même
// instant), mais la base le détecte de façon fiable — ces deux fonctions
// réagissent au conflit en déplaçant le média déjà téléversé vers un chemin
// libre puis en retentant l'écriture, plutôt que de faire simplement échouer
// l'opération pour l'utilisateur qui a perdu la course.

const MAX_MEDIA_CONFLICT_RETRIES = 5

/** Erreur levée par patchThematiqueWithMediaRetry quand aucune retry n'a abouti (conflit non résolu ou erreur non liée à un conflit média). Porte les derniers chemins Storage effectivement utilisés, pour que l'appelant sache lesquels restaurer (voir useBibli.ts updateThematique). */
// Comme BibliothequeServiceError (voir errors.ts) : "extends Error" pour rester
// une vraie erreur JS, et "public readonly" devant les paramètres du
// constructeur pour créer + assigner automatiquement les propriétés
// this.cause / this.lastImageUrl / this.lastIconUrl sans code supplémentaire.
export class ThematiqueMediaWriteError extends Error {
    constructor(public readonly cause: unknown, public readonly lastImageUrl: string, public readonly lastIconUrl: string) {
        super("Échec de l'écriture de la thématique après tentative(s) de résolution de conflit média")
    }
}

async function relocateOnConflict(
    conflict: mediaConflict.MediaConflict,
    label: string,
    excludeId: string | undefined,
    imageUrl: string,
    iconUrl: string,
    attempt: number,
): Promise<{ imageUrl: string; iconUrl: string } | null> {
    if (conflict.field === "image" && imageUrl) {
        return { imageUrl: await mediaConflict.relocateThematiqueMedia(imageUrl, label, excludeId, "image", attempt), iconUrl }
    }
    if (conflict.field === "icon" && iconUrl) {
        return { imageUrl, iconUrl: await mediaConflict.relocateThematiqueMedia(iconUrl, label, excludeId, "icon", attempt) }
    }
    // Le conflit porte sur un champ que cette écriture n'a pas rempli (ex: pas
    // d'image téléversée) — rien à relocaliser, l'erreur d'origine est réelle.
    return null
}

export async function insertThematiqueWithMediaRetry(
    label: string,
    labelEn: string,
    imageUrl: string,
    iconUrl: string,
    position: number,
    userId: string,
): Promise<ThematiqueRow> {
    let currentImageUrl = imageUrl
    let currentIconUrl = iconUrl
    for (let attempt = 2; attempt <= MAX_MEDIA_CONFLICT_RETRIES + 1; attempt++) {
        try {
            return await insertThematique(label, labelEn, currentImageUrl, currentIconUrl, position, userId)
        } catch (err) {
            const conflict = mediaConflict.detectMediaConflict(err)
            if (!conflict) throw err
            // excludeId: undefined — création, aucune ligne à exclure du check
            const relocated = await relocateOnConflict(conflict, label, undefined, currentImageUrl, currentIconUrl, attempt)
            if (!relocated) throw err
            currentImageUrl = relocated.imageUrl
            currentIconUrl = relocated.iconUrl
        }
    }
    throw new Error(`Conflit média non résolu pour "${label}" après ${MAX_MEDIA_CONFLICT_RETRIES} tentatives`)
}

export async function patchThematiqueWithMediaRetry(
    id: string,
    label: string,
    labelEn: string,
    imageUrl: string,
    iconUrl: string,
): Promise<{ imageUrl: string; iconUrl: string }> {
    let currentImageUrl = imageUrl
    let currentIconUrl = iconUrl
    for (let attempt = 2; attempt <= MAX_MEDIA_CONFLICT_RETRIES + 1; attempt++) {
        try {
            await patchThematique(id, label, labelEn, currentImageUrl, currentIconUrl)
            return { imageUrl: currentImageUrl, iconUrl: currentIconUrl }
        } catch (err) {
            const conflict = mediaConflict.detectMediaConflict(err)
            const relocated = conflict
                ? await relocateOnConflict(conflict, label, id, currentImageUrl, currentIconUrl, attempt)
                : null
            if (!relocated) throw new ThematiqueMediaWriteError(err, currentImageUrl, currentIconUrl)
            currentImageUrl = relocated.imageUrl
            currentIconUrl = relocated.iconUrl
        }
    }
    throw new ThematiqueMediaWriteError(
        new Error(`Conflit média non résolu pour "${label}" après ${MAX_MEDIA_CONFLICT_RETRIES} tentatives`),
        currentImageUrl, currentIconUrl,
    )
}

// ── Brief & Chiffres ───────────────────────────────────────────────────────────
// Le brief est un singleton (une seule ligne en base, id toujours = 1).
// "upsert" = insert si la ligne n'existe pas encore, update si elle existe.
// onConflict: "id" indique à Supabase la colonne à utiliser pour détecter le conflit.

export async function upsertBrief(briefFr: string, briefEn: string): Promise<void> {
    const { error } = await db
        .from(TABLE_NAMES.brief)
        .upsert({ id: 1, brief: briefFr, brief_en: briefEn }, { onConflict: "id" })
    throwIfError("upsertBrief", error)
}

export async function upsertChiffres(chiffresFr: string, chiffresEn: string): Promise<void> {
    const { error } = await db
        .from(TABLE_NAMES.brief)
        .upsert({ id: 1, chiffres: chiffresFr, chiffres_en: chiffresEn }, { onConflict: "id" })
    throwIfError("upsertChiffres", error)
}

// ── Questions / Réponses ───────────────────────────────────────────────────────
// Même pattern que les thématiques : insert / patch / remove.

export async function insertQR(
    thematiqueId: string,
    data: QRContent,
    position: number,
    userId: string,
): Promise<QRRow> {
    const { data: row, error } = await db
        .from(TABLE_NAMES.questionsReponses)
        .insert([{
            thematique_id: thematiqueId,
            question: data.question,
            question_en: data.questionEn,
            brief_qr: data.briefQr,
            brief_qr_en: data.briefQrEn,
            position,
            created_by: userId,
        }])
        .select("*")
        .single()
    throwIfError("insertQR", error)
    return row as unknown as QRRow
}

export async function patchQR(id: string, data: QRContent, thematiqueId: string): Promise<void> {
    const { error } = await db
        .from(TABLE_NAMES.questionsReponses)
        .update({
            thematique_id: thematiqueId,
            question: data.question,
            question_en: data.questionEn,
            brief_qr: data.briefQr,
            brief_qr_en: data.briefQrEn,
        })
        .eq("id", id)
    throwIfError("patchQR", error)
}

export async function removeQR(id: string): Promise<void> {
    const { error } = await db.from(TABLE_NAMES.questionsReponses).delete().eq("id", id)
    throwIfError("removeQR", error)
}

// ── Formats de réponse ─────────────────────────────────────────────────────────
// Chaque Q&R peut avoir UN enregistrement de formats (une ligne dans la table).
// onConflict: "quest_rep_id" : si un format existe déjà pour cette Q&R, on le met à jour.

export async function upsertFormatMap(qrId: string, map: FormatMap): Promise<void> {
    const { error } = await db
        .from(TABLE_NAMES.formatReponses)
        .upsert(
            {
                quest_rep_id: qrId,
                email: map.email, email_en: map.emailEn,
                instagram: map.instagram, instagram_en: map.instagramEn,
                whatsapp: map.whatsapp, whatsapp_en: map.whatsappEn,
            },
            { onConflict: "quest_rep_id" }
        )
    throwIfError("upsertFormatMap", error)
}

// ── Souscriptions Realtime ─────────────────────────────────────────────────────
// Déplacé de hooks/data/useBiblioRealtime.ts : ce hook parlait directement
// au client `db`, en contournant la couche service (voir CLAUDE.md "couche
// service obligatoire"). Le hook ne fait plus que fournir les callbacks
// (mapping snake_case → camelCase + mise à jour du state React) ; l'ouverture
// du canal, le nom du canal et l'abonnement aux 11 combinaisons table/événement
// vivent ici, comme le reste des accès à `db`.

export interface BiblioRealtimeHandlers {
    onThematiqueInsert: (payload: RealtimePayload<ThematiqueRow>) => void
    onThematiqueUpdate: (payload: RealtimePayload<ThematiqueRow>) => void
    onThematiqueDelete: (payload: RealtimePayload<ThematiqueRow>) => void
    onQRInsert: (payload: RealtimePayload<QRRow>) => void
    onQRUpdate: (payload: RealtimePayload<QRRow>) => void
    onQRDelete: (payload: RealtimePayload<QRRow>) => void
    onFormatInsert: (payload: RealtimePayload<FormatRow>) => void
    onFormatUpdate: (payload: RealtimePayload<FormatRow>) => void
    onFormatDelete: (payload: RealtimePayload<FormatRow>) => void
    onBriefInsert: (payload: RealtimePayload<BriefRow>) => void
    onBriefUpdate: (payload: RealtimePayload<BriefRow>) => void
}

// `ReturnType<typeof db.channel>` est un type calculé : `typeof db.channel`
// récupère le type de la fonction db.channel, et `ReturnType<...>` en extrait
// le type de retour. Ça évite de dupliquer à la main le type exact renvoyé
// par le client Supabase — s'il change de version, ce type suit automatiquement.
export type BiblioRealtimeChannel = ReturnType<typeof db.channel>

/** Ouvre un canal Realtime unique pour `userId` et branche un handler par table/événement. */
export function subscribeBiblioRealtime(userId: string, handlers: BiblioRealtimeHandlers): BiblioRealtimeChannel {
    return db
        .channel(`bibliotheque_realtime_${userId}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: TABLE_NAMES.thematiques }, handlers.onThematiqueInsert)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: TABLE_NAMES.thematiques }, handlers.onThematiqueUpdate)
        .on("postgres_changes", { event: "DELETE", schema: "public", table: TABLE_NAMES.thematiques }, handlers.onThematiqueDelete)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: TABLE_NAMES.questionsReponses }, handlers.onQRInsert)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: TABLE_NAMES.questionsReponses }, handlers.onQRUpdate)
        .on("postgres_changes", { event: "DELETE", schema: "public", table: TABLE_NAMES.questionsReponses }, handlers.onQRDelete)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: TABLE_NAMES.formatReponses }, handlers.onFormatInsert)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: TABLE_NAMES.formatReponses }, handlers.onFormatUpdate)
        .on("postgres_changes", { event: "DELETE", schema: "public", table: TABLE_NAMES.formatReponses }, handlers.onFormatDelete)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: TABLE_NAMES.brief }, handlers.onBriefInsert)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: TABLE_NAMES.brief }, handlers.onBriefUpdate)
        .subscribe()
}

/** Coupe la connexion Realtime ouverte par subscribeBiblioRealtime. */
export function unsubscribeBiblioRealtime(channel: BiblioRealtimeChannel): void {
    db.removeChannel(channel)
}

// ── Ré-exports (upload/rename/delete de médias, utilisés par useBibli.ts) ─────
// Réexportés ici pour que useBibli.ts n'ait besoin d'importer qu'un seul
// module CRUD+médias — bibliothequeMediaService.ts reste la seule source de
// vérité pour leur implémentation.
export {
    uploadThematiqueImage,
    uploadThematiqueIcon,
    syncThematiqueMediaNaming,
    resolveThematiqueMediaUrl,
    revertMediaMove,
    deleteThematiqueMedia,
    replaceThematiqueImage,
} from "./bibliothequeMediaService"
