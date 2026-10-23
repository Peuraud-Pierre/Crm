import { supabase } from "@/integrations/supabase/client"
import type { Fournisseur } from "@/features/crm/types"

export async function fetchFournisseurs(): Promise<Fournisseur[]> {
    const { data, error } = await supabase
        .from("categories_gestion")
        .select("id, name, tag")

    if (error) throw error

    return (data ?? []).map((item) => ({
        id: item.id,
        name: item.name || "",
        tag: item.tag || undefined,
    }))
}
