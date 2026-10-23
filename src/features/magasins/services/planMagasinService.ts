// ── services/planMagasinService.ts ────────────────────────────────────────────
// Couche service — plan d'un magasin (tables `zones_magasin`,
// `emplacements_magasin` et `equipements_magasin`).
//
// Le plan d'un magasin est chargé à plat, en trois requêtes, puis recomposé
// côté client (`utils/planTree.ts`) : il tient en mémoire.
//
// CE FICHIER EST IMPORTÉ PAR :
//   - hooks/data/usePlanMagasin.ts

import { supabase } from "@/integrations/supabase/client"
import type { Json } from "@/integrations/supabase/types"
import { MAGASIN_TABLES } from "@/features/magasins/constants"
import type {
    EmplacementFormInput,
    EmplacementMagasin,
    EquipementKind,
    EquipementMagasin,
    PlanGeometry,
    PlanItemType,
    Point,
    ZoneFormInput,
    ZoneMagasin,
} from "@/features/magasins/types/magasin.types"

export async function fetchZones(magasinId: string): Promise<ZoneMagasin[]> {
    const { data, error } = await supabase
        .from(MAGASIN_TABLES.zones)
        .select("*")
        .eq("magasin_id", magasinId)
        .order("sort_order", { ascending: true })
        .order("code", { ascending: true })

    if (error || !data) throw error
    return data as ZoneMagasin[]
}

export async function fetchEmplacements(magasinId: string): Promise<EmplacementMagasin[]> {
    const { data, error } = await supabase
        .from(MAGASIN_TABLES.emplacements)
        .select("*")
        .eq("magasin_id", magasinId)
        .order("code", { ascending: true })

    if (error || !data) throw error
    return data as EmplacementMagasin[]
}

/** Géométrie facultative : une zone dessinée sur le plan naît placée. */
export async function insertZone(
    magasinId: string,
    input: ZoneFormInput & Partial<PlanGeometry> & { etage_id: string; forme?: Point[] | null },
): Promise<ZoneMagasin> {
    const { forme, ...rest } = input
    const { data, error } = await supabase
        .from(MAGASIN_TABLES.zones)
        .insert({ ...rest, forme: (forme ?? null) as unknown as Json, magasin_id: magasinId })
        .select()
        .single()

    if (error) throw error
    return data as ZoneMagasin
}

/**
 * Nouvelle forme d'une zone ou d'un équipement : son rectangle englobant et le
 * tracé relatif (`null` = redevenir un rectangle).
 */
export async function patchShape(
    type: "zone" | "equipement",
    id: string,
    geometry: PlanGeometry,
    forme: Point[] | null,
): Promise<void> {
    const table = type === "zone" ? MAGASIN_TABLES.zones : (MAGASIN_TABLES.equipements as typeof MAGASIN_TABLES.zones)
    const { error } = await supabase
        .from(table)
        .update({ ...geometry, forme: forme as unknown as Json })
        .eq("id", id)
    if (error) throw error
}

export async function patchZone(id: string, input: Partial<ZoneFormInput>): Promise<void> {
    const { error } = await supabase.from(MAGASIN_TABLES.zones).update(input).eq("id", id)
    if (error) throw error
}

/** Emporte les sous-zones et leurs emplacements (cascade en base). */
export async function removeZone(id: string): Promise<void> {
    const { error } = await supabase.from(MAGASIN_TABLES.zones).delete().eq("id", id)
    if (error) throw error
}

export async function insertEmplacement(
    magasinId: string,
    input: EmplacementFormInput,
): Promise<EmplacementMagasin> {
    const { data, error } = await supabase
        .from(MAGASIN_TABLES.emplacements)
        .insert({ ...input, magasin_id: magasinId })
        .select()
        .single()

    if (error) throw error
    return data as EmplacementMagasin
}

export async function patchEmplacement(id: string, input: Partial<EmplacementFormInput>): Promise<void> {
    const { error } = await supabase.from(MAGASIN_TABLES.emplacements).update(input).eq("id", id)
    if (error) throw error
}

export async function removeEmplacement(id: string): Promise<void> {
    const { error } = await supabase.from(MAGASIN_TABLES.emplacements).delete().eq("id", id)
    if (error) throw error
}

export async function fetchEquipements(magasinId: string): Promise<EquipementMagasin[]> {
    const { data, error } = await supabase
        .from(MAGASIN_TABLES.equipements)
        .select("*")
        .eq("magasin_id", magasinId)
        .order("code", { ascending: true })

    if (error || !data) throw error
    return data as EquipementMagasin[]
}

/**
 * Un équipement naît en général placé. Un mannequin créé depuis l'onglet
 * Emplacements naît rattaché à sa zone et sans position (`geometry` vide) :
 * il attend dans la palette « à placer », comme un portant.
 */
export async function insertEquipement(
    magasinId: string,
    etageId: string,
    kind: EquipementKind,
    code: string,
    geometry: PlanGeometry,
    zoneId: string | null = null,
): Promise<EquipementMagasin> {
    const { data, error } = await supabase
        .from(MAGASIN_TABLES.equipements)
        .insert({ magasin_id: magasinId, etage_id: etageId, kind, code, ...geometry, zone_id: zoneId })
        .select()
        .single()

    if (error) throw error
    return data as EquipementMagasin
}

/** Regroupe des équipements (escalier fusionné) ; `null` les sépare. */
export async function setGroupe(ids: readonly string[], groupe: string | null): Promise<void> {
    const { error } = await supabase.from(MAGASIN_TABLES.equipements).update({ groupe }).in("id", [...ids])
    if (error) throw error
}

/** Rattache un équipement (mannequin) à une zone ; `null` le détache. */
export async function setEquipementZone(id: string, zoneId: string | null): Promise<void> {
    const { error } = await supabase.from(MAGASIN_TABLES.equipements).update({ zone_id: zoneId }).eq("id", id)
    if (error) throw error
}

/** Sens d'escaliers (toutes les volées d'un escalier fusionné à la fois). */
export async function setDescend(ids: readonly string[], descend: boolean): Promise<void> {
    const { error } = await supabase.from(MAGASIN_TABLES.equipements).update({ descend }).in("id", [...ids])
    if (error) throw error
}

export async function removeEquipements(ids: readonly string[]): Promise<void> {
    const { error } = await supabase.from(MAGASIN_TABLES.equipements).delete().in("id", [...ids])
    if (error) throw error
}

export async function removeEquipement(id: string): Promise<void> {
    const { error } = await supabase.from(MAGASIN_TABLES.equipements).delete().eq("id", id)
    if (error) throw error
}

// Les trois tables portent les mêmes colonnes de géométrie : le client typé
// de l'une vaut pour les autres sur ce seul `update`.
const TABLE_OF: Record<PlanItemType, typeof MAGASIN_TABLES.zones> = {
    zone: MAGASIN_TABLES.zones,
    emplacement: MAGASIN_TABLES.emplacements as typeof MAGASIN_TABLES.zones,
    equipement: MAGASIN_TABLES.equipements as typeof MAGASIN_TABLES.zones,
}

export interface GeometryChange {
    type: PlanItemType
    id: string
    geometry: PlanGeometry
}

/**
 * Enregistre les positions modifiées dans l'éditeur. Une requête par élément,
 * en parallèle : PostgREST ne sait pas mettre à jour plusieurs lignes avec des
 * valeurs différentes, et un plan de magasin change rarement plus de quelques
 * dizaines d'éléments à la fois. La première erreur est remontée.
 */
export async function saveGeometries(changes: readonly GeometryChange[]): Promise<void> {
    const results = await Promise.all(
        changes.map(({ type, id, geometry }) =>
            supabase
                .from(TABLE_OF[type])
                .update(geometry)
                .eq("id", id),
        ),
    )
    const failed = results.find((r) => r.error)
    if (failed?.error) throw failed.error
}
