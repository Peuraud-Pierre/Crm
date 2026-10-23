// ── hooks/data/useBiblioRealtime.ts ───────────────────────────────────────────
// RÔLE : Souscriptions Supabase Realtime pour la feature Bibliothèque.
//
// Extrait de useBibli.ts pour séparer une responsabilité à part entière :
// useBibli.ts gère le chargement initial + le CRUD optimiste, ce hook gère
// UNIQUEMENT la synchronisation temps réel (écoute des changements faits par
// d'autres utilisateurs). Aucun état ne vit ici — tout est reçu en paramètres
// (setters + refs de position) et mis à jour directement dans useBibli.ts.
//
// Pour chaque événement Realtime, on met à jour L'ÉTAT LOCAL directement depuis
// le payload au lieu de re-fetcher toute la table (plus rapide, moins de bande
// passante).
//   payload.new = ligne APRÈS la modification (disponible sur INSERT et UPDATE)
//   payload.old = uniquement la clé primaire (disponible sur DELETE)
//
// L'ouverture du canal Realtime (db.channel/.on/.subscribe/.removeChannel) vit
// dans services/bibliothequeService.ts (subscribeBiblioRealtime /
// unsubscribeBiblioRealtime) — ce hook ne parle plus directement au client `db`,
// conformément à la règle "couche service obligatoire" (CLAUDE.md). Il ne fait
// que fournir les callbacks (mapping snake_case → camelCase + setState).
//
// CE FICHIER EST IMPORTÉ PAR :
//   - hooks/data/useBibli.ts → seul consommateur

import { useEffect } from "react"
import type { Dispatch, SetStateAction, RefObject } from "react"
import type { z } from "zod"
import type { Thematique, QR, FormatMap, Brief } from "@/features/bibliotheque/types"
import type { ThematiqueRow, QRRow, FormatRow, BriefRow, RealtimePayload } from "../../services/mappers"
import {
    thematiqueRowSchema, qrRowSchema, formatRowSchema, briefRowSchema,
    rowIdSchema, formatRowOldSchema,
    mapThematique, mapQR, mapFormatRow, mapBriefRow,
} from "../../services/mappers"
import { subscribeBiblioRealtime, unsubscribeBiblioRealtime } from "../../services/bibliothequeService"

// Valide un payload Realtime avec le schéma attendu ; si la forme ne correspond
// pas (colonne renommée côté DB, migration non répercutée ici...), on logue
// l'écart et on ignore l'événement plutôt que de propager une donnée corrompue
// dans le state — un événement Realtime manqué est rattrapable au prochain
// fetch, une donnée corrompue dans le state ne l'est pas.
function parseOrWarn<T>(schema: z.ZodType<T>, value: unknown, context: string): T | undefined {
    const result = schema.safeParse(value)
    if (!result.success) {
        console.error(`[bibliotheque] payload Realtime inattendu (${context}) :`, result.error.issues)
        return undefined
    }
    return result.data
}

// Dispatch<SetStateAction<T>> = type d'une fonction "setXxx" issue d'un
// useState<T>(...) ailleurs (ici dans useBibli.ts) ; RefObject<T> = type d'une
// valeur créée par useRef<T>(...), un objet `{ current: T }` qui survit entre
// les rendus sans provoquer de re-render. Ce hook ne fait QUE recevoir ces
// setters/refs en paramètres pour les utiliser, il ne les crée pas lui-même.
// RealtimePayload<T> est un "generic" : T change selon la table concernée
// (ThematiqueRow, QRRow, ...) mais la forme du payload (avec .new et .old,
// voir plus haut) reste toujours la même.
interface UseBiblioRealtimeParams {
    userId: string | undefined
    fetchAll: () => Promise<void>
    setThematiques: Dispatch<SetStateAction<Thematique[]>>
    setQRs: Dispatch<SetStateAction<QR[]>>
    setFormatReponses: Dispatch<SetStateAction<Record<string, FormatMap>>>
    setBrief: Dispatch<SetStateAction<Brief>>
    maxThematiquePos: RefObject<number>
    maxQRPosByThematique: RefObject<Record<string, number>>
}

// useEffect s'exécute après le premier rendu, puis à chaque fois que userId
// ou fetchAll change. La fonction retournée (cleanup) est appelée quand le
// composant se démonte pour couper la connexion Realtime.
export function useBiblioRealtime({
    userId, fetchAll,
    setThematiques, setQRs, setFormatReponses, setBrief,
    maxThematiquePos, maxQRPosByThematique,
}: UseBiblioRealtimeParams) {
    useEffect(() => {
        // On ne souscrit pas si l'utilisateur n'est pas encore authentifié
        if (!userId) return

        // Chargement initial des données au montage
        fetchAll()

        // Un canal Realtime unique par utilisateur, ouvert par le service
        const channel = subscribeBiblioRealtime(userId, {
            // Chaque payload est validé (parseOrWarn) avant le cast `as XRow` :
            // le service ne peut pas garantir la forme du payload brut de Supabase
            // (généraliste), donc on vérifie les champs effectivement utilisés
            // (id, position, clés étrangères...) avant de faire confiance au reste
            // (coalescé avec `?? ""` par mappers.ts). Payload invalide → événement
            // ignoré (loggé), plutôt qu'une donnée corrompue propagée dans le state.
            onThematiqueInsert: (payload: RealtimePayload<ThematiqueRow>) => {
                if (!parseOrWarn(thematiqueRowSchema, payload.new, "onThematiqueInsert")) return
                const row = payload.new as ThematiqueRow
                maxThematiquePos.current = Math.max(maxThematiquePos.current, row.position)
                const item = mapThematique(row)
                // .some(...) renvoie true si AU MOINS UN élément du tableau vérifie
                // la condition — ici, on vérifie que cette thématique n'est pas déjà
                // présente (évite un doublon si la mise à jour optimiste de
                // useBibli.ts a déjà ajouté l'élément avant que Realtime confirme).
                setThematiques((prev) => prev.some((t) => t.id === item.id) ? prev : [...prev, item])
            },
            onThematiqueUpdate: (payload: RealtimePayload<ThematiqueRow>) => {
                if (!parseOrWarn(thematiqueRowSchema, payload.new, "onThematiqueUpdate")) return
                const updated = mapThematique(payload.new as ThematiqueRow)
                setThematiques((prev) => prev.map((t) => t.id === updated.id ? updated : t))
            },
            onThematiqueDelete: (payload: RealtimePayload<ThematiqueRow>) => {
                const parsed = parseOrWarn(rowIdSchema, payload.old, "onThematiqueDelete")
                if (!parsed) return
                setThematiques((prev) => prev.filter((t) => t.id !== parsed.id))
            },

            onQRInsert: (payload: RealtimePayload<QRRow>) => {
                if (!parseOrWarn(qrRowSchema, payload.new, "onQRInsert")) return
                const row = payload.new as QRRow
                maxQRPosByThematique.current[row.thematique_id] = Math.max(
                    maxQRPosByThematique.current[row.thematique_id] ?? -1,
                    row.position
                )
                const item = mapQR(row)
                setQRs((prev) => prev.some((qr) => qr.id === item.id) ? prev : [...prev, item])
            },
            onQRUpdate: (payload: RealtimePayload<QRRow>) => {
                if (!parseOrWarn(qrRowSchema, payload.new, "onQRUpdate")) return
                const updated = mapQR(payload.new as QRRow)
                setQRs((prev) => prev.map((qr) => qr.id === updated.id ? updated : qr))
            },
            onQRDelete: (payload: RealtimePayload<QRRow>) => {
                const parsed = parseOrWarn(rowIdSchema, payload.old, "onQRDelete")
                if (!parsed) return
                setQRs((prev) => prev.filter((qr) => qr.id !== parsed.id))
            },

            // INSERT et UPDATE ont le même comportement : upsert dans le dictionnaire
            onFormatInsert: (payload: RealtimePayload<FormatRow>) => {
                if (!parseOrWarn(formatRowSchema, payload.new, "onFormatInsert")) return
                const [qrId, fmt] = mapFormatRow(payload.new as FormatRow)
                setFormatReponses((prev) => ({ ...prev, [qrId]: fmt }))
            },
            onFormatUpdate: (payload: RealtimePayload<FormatRow>) => {
                if (!parseOrWarn(formatRowSchema, payload.new, "onFormatUpdate")) return
                const [qrId, fmt] = mapFormatRow(payload.new as FormatRow)
                setFormatReponses((prev) => ({ ...prev, [qrId]: fmt }))
            },
            onFormatDelete: (payload: RealtimePayload<FormatRow>) => {
                // Le state local `formatReponses` est indexé par `quest_rep_id`
                // (la Q&R), pas par `id` de la ligne de formats — il faut donc
                // `quest_rep_id` dans le payload DELETE, pas juste la PK.
                // Ce n'est disponible que parce que bibliotheque_format_reponses
                // a REPLICA IDENTITY FULL (migration
                // 20260716120000_bibliotheque_realtime.sql) ; sans FULL, `old`
                // ne contiendrait que `id` et ce champ vaudrait undefined.
                const parsed = parseOrWarn(formatRowOldSchema, payload.old, "onFormatDelete")
                const qrId = parsed?.quest_rep_id
                if (!qrId) return
                setFormatReponses((prev) => {
                    const next = { ...prev }
                    delete next[qrId]
                    return next
                })
            },

            // INSERT et UPDATE ont le même comportement : remplace l'état local du brief.
            // Le brief est un singleton (id = 1) donc DELETE n'est pas géré.
            onBriefInsert: (payload: RealtimePayload<BriefRow>) => {
                if (!parseOrWarn(briefRowSchema, payload.new, "onBriefInsert")) return
                setBrief(mapBriefRow(payload.new as BriefRow))
            },
            onBriefUpdate: (payload: RealtimePayload<BriefRow>) => {
                if (!parseOrWarn(briefRowSchema, payload.new, "onBriefUpdate")) return
                setBrief(mapBriefRow(payload.new as BriefRow))
            },
        })

        return () => { unsubscribeBiblioRealtime(channel) }
    }, [userId, fetchAll, setThematiques, setQRs, setFormatReponses, setBrief, maxThematiquePos, maxQRPosByThematique])
}
