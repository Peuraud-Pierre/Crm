import { buildEmplacementPaths } from "./planHelpers"
import type { Emplacement, ZoneNode } from "@/features/stock_handpick/types/location.types"

/**
 * Vocabulaire du plan : zones, rangées, travées, hauteurs, et l'index qui
 * relie ces codes aux emplacements en base. La GÉOMÉTRIE (où est chaque rack,
 * bureau, porte) vit dans `floorPlan.ts`.
 *
 * Première version de la disposition, gardée pour mémoire des codes :
 *
 *   ┌──────────────── B (Bags) ───────────────┐┌── A (Annexe) ──┐
 *   │ R1 : E1 │ E2 │ E3 │ E4 │ E5  ← mur du haut ││                │
 *   │ R2 : E1 │ E2 │ E3 │ E4 │ E5                │└────────────────┘
 * → │ R3 : E1 │ E2 │ E3 │ E4 │ E5  ← mur du bas  │┌── D (Display) ─┐
 *   └──────────────────────────────────────────┘│                │
 *                                               └───── entrée ───┘
 *
 * B compte trois rangées de racks à palettes (photo : la rangée du milieu),
 * de cinq travées chacune, sur trois hauteurs : H0 au sol, H2 en haut.
 *
 * La disposition est FIXE ici, mais les emplacements viennent de la base : ils
 * sont retrouvés par leur chemin de codes (`B/R2/E3/H1`), créé par les
 * migrations 20260917160000 et 20260917170000. Un emplacement renommé sort du
 * dessin, pas de l'inventaire.
 */

export type PlanZoneCode = "A" | "B" | "D"

export const PLAN_ZONES: Record<PlanZoneCode, { code: PlanZoneCode; label: string }> = {
    A: { code: "A", label: "Annexe" },
    B: { code: "B", label: "Bags" },
    D: { code: "D", label: "Display" },
}

/**
 * Racks adressables de la zone B : R1 contre le mur du haut, R2 et R3 les
 * deux faces du rack double du milieu, R4 en bas, R5 le rack vertical côté
 * passerelle de l'annexe.
 */
export const PLAN_ROWS = ["R1", "R2", "R3", "R4", "R5"] as const
export type PlanRow = (typeof PLAN_ROWS)[number]

export const PLAN_ROW_LABELS: Record<PlanRow, string> = {
    R1: "Haut",
    R2: "Double haut",
    R3: "Double bas",
    R4: "Bas",
    R5: "Vertical",
}

/**
 * Codes de travée possibles, dans l'ordre du mur. Toutes les rangées ne les
 * ont pas tous : voir `rowBays`.
 */
export const PLAN_BAYS = ["E1", "E2", "E3", "E4", "E5"] as const
export type PlanBay = (typeof PLAN_BAYS)[number]

/** Toutes les travées possibles d'une rangée. */
export const PLAN_SHELVES = PLAN_BAYS
export type PlanShelf = PlanBay

/**
 * Nombre de travées de chaque rangée : c'est la GÉOMÉTRIE, la longueur du
 * rack est partagée en autant de travées égales. R4 et R5 n'en ont que trois
 * (E1…E3) ; leurs anciennes E4 / E5 sont désactivées en base (migration
 * 20260924100000).
 */
const ROW_BAY_COUNT: Record<PlanRow, number> = { R1: 5, R2: 5, R3: 5, R4: 3, R5: 3 }

/** Les travées d'une rangée, trous compris (chacune a sa place dans le rack). */
export const rowBays = (row: PlanRow): readonly PlanBay[] => PLAN_BAYS.slice(0, ROW_BAY_COUNT[row])

/**
 * Travées démontées, par rangée : leur place reste vide dans le rack (un
 * trou), et leurs emplacements en base sont désactivés (migration
 * 20260923140000) — plus rien ne peut y être rangé. Seule R1 a perdu sa
 * travée E4.
 */
const REMOVED_SHELVES: Partial<Record<PlanRow, readonly PlanShelf[]>> = {
    R1: ["E4"],
}

/** Vrai si la rangée a une vraie travée à cet emplacement (pas un trou). */
export const isPlanShelf = (row: PlanRow, bay: PlanBay): boolean =>
    rowBays(row).includes(bay) && !REMOVED_SHELVES[row]?.includes(bay)

/**
 * Travées sans rack : une simple palette au sol, au seul niveau H0. E1 et E2
 * du rack double (R2 et R3) ; leurs H1 / H2 sont désactivés en base
 * (migration 20260924100000).
 */
const PALLET_SHELVES: Partial<Record<PlanRow, readonly PlanShelf[]>> = {
    R2: ["E1", "E2"],
    R3: ["E1", "E2"],
}

export const isPalletShelf = (row: PlanRow, bay: PlanBay): boolean =>
    Boolean(PALLET_SHELVES[row]?.includes(bay))

/** Hauteurs, de haut en bas — l'ordre de lecture d'une étagère. */
export const PLAN_LEVELS = ["H2", "H1", "H0"] as const
export type PlanLevel = (typeof PLAN_LEVELS)[number]

/** Hauteurs réelles d'une travée : H0 seul pour une palette au sol. */
export const shelfLevels = (row: PlanRow, bay: PlanBay): readonly PlanLevel[] =>
    isPalletShelf(row, bay) ? ["H0"] : PLAN_LEVELS

export type PlanSelection =
    | { kind: "shelf"; row: PlanRow; shelf: PlanShelf }
    | { kind: "zone"; zone: PlanZoneCode }

export interface PlanIndex {
    /** `b/e2/h2` → id d'emplacement. */
    byPath: Map<string, string>
    /** Code de zone racine → ids de tous ses emplacements. */
    byZone: Map<string, string[]>
}

export const shelfLevelKey = (row: PlanRow, shelf: PlanShelf, level: PlanLevel) =>
    `b/${row}/${shelf}/${level}`.toLowerCase()

export function buildPlanIndex(zones: ZoneNode[], emplacements: Emplacement[]): PlanIndex {
    const byPath = new Map<string, string>()
    const byZone = new Map<string, string[]>()

    for (const [id, path] of buildEmplacementPaths(zones, emplacements)) {
        byPath.set(path.segments.join("/").toLowerCase(), id)
        const root = path.segments[0]?.toUpperCase()
        if (!root) continue
        const list = byZone.get(root) ?? []
        list.push(id)
        byZone.set(root, list)
    }

    return { byPath, byZone }
}
