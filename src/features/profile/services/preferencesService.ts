// Couche service des préférences utilisateur (table public.user_preferences).
// Une ligne par utilisateur, créée à la volée : l'absence de ligne est un
// état valide, le hook appelant retombe alors sur DEFAULT_PREFERENCES.
import { supabase } from "@/integrations/supabase/client"
import { type UserPreferences, type ThemeChoice } from "../types"

const COLUMNS = "user_id, theme, push_enabled, notify_ticket, notify_message, notify_system"

/** Préférences de l'utilisateur, ou null s'il n'a encore rien enregistré. */
export async function fetchUserPreferences(
    userId: string
): Promise<UserPreferences | null> {
    const { data, error } = await supabase
        .from("user_preferences")
        .select(COLUMNS)
        .eq("user_id", userId)
        .maybeSingle()

    if (error) throw error
    if (!data) return null

    // `theme` est un `text` côté typage généré ; le CHECK SQL garantit
    // qu'il fait partie des trois valeurs de ThemeChoice.
    return { ...data, theme: data.theme as ThemeChoice }
}

/**
 * Enregistre tout ou partie des préférences. `upsert` sur la clé primaire :
 * crée la ligne au premier réglage, la met à jour ensuite.
 */
export async function saveUserPreferences(
    userId: string,
    patch: Partial<Omit<UserPreferences, "user_id">>
): Promise<void> {
    const { error } = await supabase
        .from("user_preferences")
        .upsert({ user_id: userId, ...patch }, { onConflict: "user_id" })

    if (error) throw error
}
