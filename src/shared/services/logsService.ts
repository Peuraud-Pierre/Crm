import { supabase } from "@/integrations/supabase/client"
import type { Json } from "@/integrations/supabase/types"

/**
 * Service d'écriture des logs applicatifs (table app_logs).
 * Requêtes déplacées telles quelles depuis errorLogger et AppErrorBoundary
 * (couche service obligatoire — voir Architecture_Feature.pdf §5).
 */

export interface AppLogEntry {
    level: "error" | "warn" | "info"
    message: string
    user_id: string
    user_email?: string | null
    url: string
    stack?: string | null
    session_id: string | null
    browser: string
    context?: Record<string, unknown> | null
}

/** Insère une entrée dans app_logs. */
export async function insertAppLog(entry: AppLogEntry) {
    const { context, ...rest } = entry
    return supabase.from("app_logs").insert({
        ...rest,
        // Conversion sûre (pas de changement de comportement) : supabase-js
        // sérialise l'objet en JSON à l'envoi ; le type généré exige `Json`
        // mais tout Record sérialisable en est structurellement équivalent.
        context: (context ?? null) as Json,
    })
}
