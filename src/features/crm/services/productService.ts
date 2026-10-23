import { supabase } from "@/integrations/supabase/client"
import type { Product } from "@/features/crm/types"

export async function createProduct(product: Product): Promise<void> {
    const { error } = await supabase
        .from("product")
        .insert([product] as Product[] as never)
    if (error) throw error
}

export async function fetchProducts(): Promise<Product[]> {
    const { data, error } = await supabase
        .from("product")
        .select("*, type(id, name), fournisseur(id, name)")
    if (error) throw error
    return (data as Product[]) || []
}

export async function updateProduct(
    id: number,
    updates: Partial<Product>
): Promise<void> {
    const { error } = await supabase
        .from("product")
        .update(updates as never)
        .eq("id", id)
    if (error) throw error
}

export async function deleteProduct(id: number): Promise<void> {
    const { error } = await supabase.from("product").delete().eq("id", id)
    if (error) throw error
}
