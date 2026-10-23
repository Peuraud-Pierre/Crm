import { supabase } from "@/integrations/supabase/client"
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types"

/**
 * Couche service pour la table `journal_entry` (docs/Architecture_Feature.pdf §5).
 * Déplacé depuis hooks/Journal_hook/useJournalEntry.ts (déplacement mécanique) —
 * seule la couche service est autorisée à importer le client Supabase (règle
 * ESLint no-restricted-imports).
 */

export type JournalEntryRow = Tables<"journal_entry">

export async function fetchJournalEntries() {
    return supabase
        .from("journal_entry")
        .select("*")
        .order("created_at", { ascending: false })
}

export async function insertJournalEntry(
    payload: TablesInsert<"journal_entry">
) {
    return supabase.from("journal_entry").insert(payload).select().single()
}

export async function updateJournalEntryById(
    entryId: string,
    payload: TablesUpdate<"journal_entry">
) {
    return supabase
        .from("journal_entry")
        .update(payload)
        .eq("id", entryId)
        .select()
        .single()
}

export async function deleteJournalEntryById(entryId: string) {
    return supabase.from("journal_entry").delete().eq("id", entryId)
}
