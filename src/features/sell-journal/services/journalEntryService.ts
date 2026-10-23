// ── services/journalEntryService.ts ───────────────────────────────────────────
// Couche service — seul point d'accès Supabase de la feature Sell-Journal.
// Les opérations CRUD sur `journal_entry` vivent dans le hook partagé
// features/journal/hooks/Journal_hook/useJournalEntry ; ce service ne porte
// que l'abonnement realtime. Déplacement mécanique depuis
// context/SellJournalContext.tsx (règle no-restricted-imports).
//
// CE FICHIER EST IMPORTÉ PAR :
//   - context/SellJournalContext.tsx → seul consommateur de ce service

import { supabase } from "@/integrations/supabase/client"
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js"
import type { JournalEntry } from "@/features/journal/hooks/Journal_hook/useJournalEntry"

/**
 * Abonnement realtime à tous les événements (INSERT, UPDATE, DELETE) sur
 * `journal_entry`. Le traitement du payload reste côté contexte.
 * Retourne la fonction de désabonnement (removeChannel).
 */
export function subscribeToJournalEntries(
    userId: string,
    onEvent: (
        payload: RealtimePostgresChangesPayload<JournalEntry>
    ) => void
): () => void {
    const channel = supabase
        .channel(`realtime-events-${userId}`)
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "journal_entry", // ⚠️ Doit correspondre EXACTEMENT au nom dans Supabase
            },
            onEvent
        )
        .subscribe()

    return () => {
        supabase.removeChannel(channel)
    }
}
