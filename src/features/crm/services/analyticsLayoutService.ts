// Couche service — table public.user_crm_analytics_layout
// (docs/Architecture_Feature.pdf §5).
import { supabase } from "@/integrations/supabase/client"
import type { Json } from "@/integrations/supabase/types"
import {
    DEFAULT_SECTION_LAYOUT,
    isSectionKey,
    isSectionSize,
    type SectionLayoutItem,
} from "../types/analytics"

function parseLayoutEntry(entry: unknown): SectionLayoutItem | null {
    // Format historique (avant l'ajout de la taille) : un simple identifiant.
    if (isSectionKey(entry)) {
        const fallback = DEFAULT_SECTION_LAYOUT.find((i) => i.id === entry)
        return { id: entry, size: fallback?.size ?? "half" }
    }
    if (
        entry !== null &&
        typeof entry === "object" &&
        "id" in entry &&
        "size" in entry &&
        isSectionKey((entry as { id: unknown }).id) &&
        isSectionSize((entry as { size: unknown }).size)
    ) {
        return entry as SectionLayoutItem
    }
    return null
}

/**
 * Disposition (ordre + taille) enregistrée par l'utilisateur, filtrée aux
 * modules encore connus du registre (un module retiré du code ne doit pas
 * faire planter l'affichage) et complétée par les modules manquants dans
 * leur position/taille par défaut — sinon un module ajouté après coup
 * n'apparaîtrait jamais pour un utilisateur ayant déjà personnalisé sa vue.
 */
export async function fetchSectionLayout(
    userId: string
): Promise<SectionLayoutItem[]> {
    const { data, error } = await supabase
        .from("user_crm_analytics_layout")
        .select("section_order")
        .eq("user_id", userId)
        .maybeSingle()

    if (error) throw error
    if (!data) return DEFAULT_SECTION_LAYOUT

    const stored = Array.isArray(data.section_order)
        ? data.section_order
              .map(parseLayoutEntry)
              .filter((item): item is SectionLayoutItem => item !== null)
        : []
    const storedIds = new Set(stored.map((i) => i.id))
    const missing = DEFAULT_SECTION_LAYOUT.filter((i) => !storedIds.has(i.id))
    return [...stored, ...missing]
}

export async function saveSectionLayout(
    userId: string,
    layout: SectionLayoutItem[]
): Promise<void> {
    const { error } = await supabase.from("user_crm_analytics_layout").upsert(
        { user_id: userId, section_order: layout as unknown as Json },
        { onConflict: "user_id" }
    )

    if (error) throw error
}
