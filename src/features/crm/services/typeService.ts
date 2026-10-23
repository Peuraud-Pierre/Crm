import { supabase } from "@/integrations/supabase/client"
import type { Type_CRM } from "@/features/crm/types"

export async function createType(type: Type_CRM): Promise<string> {
    const { data, error } = await supabase
        .from("Type_product_CRM")
        .insert({ name: type.name })
        .select("id")
        .single()
    if (error) throw error
    return data.id
}

export async function fetchTypes(): Promise<Type_CRM[]> {
    const { data, error } = await supabase.from("Type_product_CRM").select("*")
    if (error) throw error
    return data || []
}

export async function deleteType(id: string): Promise<void> {
    const { error } = await supabase
        .from("Type_product_CRM")
        .delete()
        .eq("id", id)
    if (error) throw error
}
