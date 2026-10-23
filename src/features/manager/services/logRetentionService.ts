// Couche service de la feature manager — rétention des logs (RPC)
// (docs/Architecture_Feature.pdf §5). Wrappers nommés, strictement
// mécaniques, autour des RPC Supabase de purge/audit de rétention.
import { supabase } from "@/integrations/supabase/client"

/**
 * Lecture du journal des purges via RPC SECURITY DEFINER : contourne la RLS
 * (fragile sur le mapping id/user_id) tout en gardant le contrôle d'admin
 * côté base.
 */
export function fetchRetentionAudit(limit: number) {
    return supabase.rpc("get_app_logs_retention_audit", { p_limit: limit })
}

/**
 * Purge manuelle des anciens logs.
 * months : ancienneté minimale (en mois) des logs à supprimer.
 * tables : sous-ensemble de tables ciblées ; vide/undefined = toutes.
 */
export function purgeOldAppLogs(months: number, tables?: string[]) {
    const args: {
        p_mode: string
        p_months: number
        p_tables: string[] | null
    } = { p_mode: "manual", p_months: months, p_tables: null }
    if (tables && tables.length > 0) args.p_tables = tables

    return supabase.rpc("purge_old_app_logs", args)
}
