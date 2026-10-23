import type { Database } from "@/integrations/supabase/types"

type PreferencesRow = Database["public"]["Tables"]["user_preferences"]["Row"]

/** Thème applicatif — aligné sur les valeurs acceptées par next-themes. */
export type ThemeChoice = "light" | "dark" | "system"

/**
 * Préférences d'un utilisateur, telles que manipulées par l'application.
 * Dérivé de la ligne générée, avec `theme` restreint aux trois valeurs du
 * CHECK SQL (la colonne est un `text` côté typage généré).
 */
export interface UserPreferences
    extends Omit<PreferencesRow, "theme" | "created_at" | "updated_at"> {
    theme: ThemeChoice
}

/** Valeurs appliquées tant qu'aucune ligne n'existe en base. */
export const DEFAULT_PREFERENCES: Omit<UserPreferences, "user_id"> = {
    theme: "system",
    push_enabled: true,
    notify_ticket: true,
    notify_message: true,
    notify_system: true,
}

/** Champs du profil que l'utilisateur peut modifier lui-même. */
export interface ProfileIdentityInput {
    full_name: string
    phone: string | null
}

/** Abonnement à la newsletter arrivages tel que lu en base. */
export interface NewsletterSubscription {
    active: boolean
    visible_columns: string[]
}

/** Payload d'abonnement / mise à jour envoyé au service Go. */
export interface NewsletterSubscribeInput {
    email: string
    full_name: string
    visible_columns: string[]
    invitation_code: string
}
