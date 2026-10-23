import type { EmplacementMagasin, EquipementMagasin, ZoneMagasin } from "@/features/magasins/types/magasin.types"

const base = {
    magasin_id: "m1",
    label: null,
    pos_x: null,
    pos_y: null,
    width: null,
    height: null,
    rotation: 0,
    is_active: true,
    created_at: "2026-10-07",
    updated_at: "2026-10-07",
    created_by: null,
}

export function zone(id: string, code: string, kind: ZoneMagasin["kind"], parent_id: string | null = null, extra: Partial<ZoneMagasin> = {}): ZoneMagasin {
    return { ...base, id, code, kind, parent_id, etage_id: "rdc", color: null, forme: null, sort_order: 0, ...extra }
}

export function emplacement(id: string, code: string, zone_id: string, extra: Partial<EmplacementMagasin> = {}): EmplacementMagasin {
    return { ...base, id, code, zone_id, notes: null, ...extra }
}

/** A (zone) › R1 (rayon) › E1 (portant) › H1 ; B (zone) › SOL. */
export const ZONES = [
    zone("a", "A", "zone"),
    zone("b", "B", "zone", null, { sort_order: 1 }),
    zone("r1", "R1", "rayon", "a"),
    zone("e1", "E1", "etagere", "r1"),
]
export const EMPLACEMENTS = [emplacement("h1", "H1", "e1"), emplacement("sol", "SOL", "b")]

export function equipement(id: string, code: string, kind: EquipementMagasin["kind"]): EquipementMagasin {
    return { ...base, id, code, kind, etage_id: "rdc", forme: null, groupe: null, descend: false, zone_id: null }
}
