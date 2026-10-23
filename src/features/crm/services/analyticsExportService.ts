import { supabase } from "@/integrations/supabase/client"

export async function fetchExportCollaborators() {
    return supabase
        .from("analytics_export_collaborators")
        .select("user_id, fallback_name, group_index, member_index, sep_after")
        .order("group_index", { ascending: true })
        .order("member_index", { ascending: true })
}
