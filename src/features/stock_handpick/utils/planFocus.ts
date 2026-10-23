import {
    PLAN_LEVELS,
    PLAN_ROWS,
    PLAN_SHELVES,
    isPlanShelf,
    shelfLevels,
    type PlanLevel,
    type PlanRow,
    type PlanSelection,
    type PlanShelf,
} from "./planLayout"

/** Endroit du plan où faire briller une balle. */
export type PlanFocus =
    | { kind: "shelf"; row: PlanRow; shelf: PlanShelf; level: PlanLevel }
    | { kind: "zone"; zone: "A" | "D" }

const isOneOf = <T extends string>(values: readonly T[], value: string | undefined): value is T =>
    value !== undefined && (values as readonly string[]).includes(value)

/**
 * Cible d'après le chemin d'emplacement d'une balle (`B/R2/E3/H1`, `D/SOL`).
 * `null` si le chemin ne correspond à rien de dessiné.
 */
export function focusFromSegments(segments: readonly string[] | null): PlanFocus | null {
    if (!segments?.length) return null
    const [zone, row, shelf, level] = segments.map((segment) => segment.trim().toUpperCase())
    if (zone === "A" || zone === "D") return { kind: "zone", zone }
    if (zone !== "B") return null
    if (!isOneOf(PLAN_ROWS, row) || !isOneOf(PLAN_SHELVES, shelf) || !isOneOf(PLAN_LEVELS, level)) {
        return null
    }
    // Travée ou hauteur retirée du dessin (R4/E5, R2/E1/H2…) : rien à montrer.
    if (!isPlanShelf(row, shelf) || !shelfLevels(row, shelf).includes(level)) return null
    return { kind: "shelf", row, shelf, level }
}

export function selectionOfFocus(focus: PlanFocus): PlanSelection {
    return focus.kind === "shelf"
        ? { kind: "shelf", row: focus.row, shelf: focus.shelf }
        : { kind: "zone", zone: focus.zone }
}
