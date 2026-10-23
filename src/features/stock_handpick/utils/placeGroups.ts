import { BALLE_LOCATION_LABELS } from "@/features/stock_handpick/constants"
import type { BalleHandpick } from "@/features/stock_handpick/types/balle.types"
import { PLAN_ROW_LABELS, PLAN_ZONES, type PlanRow, type PlanZoneCode } from "./planLayout"

/**
 * Regroupement des balles selon l'endroit où elles sont stockées.
 *
 * Une clé de lieu est le début du chemin d'emplacement, segments joints par
 * `/` : `B` (toute la zone B), `B/R2` (le rack R2), `B/R2/E3` (sa travée E3).
 * Trois clés spéciales couvrent les balles hors plan : `borrowed`
 * (empruntées), `unplaced` (sans emplacement) et `eclatee` (éclatées, sorties
 * du stock — elles n'ont plus d'emplacement mais ne sont pas « à ranger »).
 */

export const PLACE_ALL = "all"
export const PLACE_BORROWED = "borrowed"
export const PLACE_UNPLACED = "unplaced"
export const PLACE_ECLATEE = "eclatee"

export type SegmentsFor = (emplacementId: string | null | undefined) => string[] | null

export const placeKey = (segments: readonly string[]) => segments.join("/")

/** Vrai si la balle est stockée sous la clé de lieu `place`. */
export function matchesPlace(balle: BalleHandpick, place: string, segmentsFor: SegmentsFor): boolean {
    if (place === PLACE_ALL) return true
    if (place === PLACE_ECLATEE) return balle.is_eclatee
    if (balle.is_eclatee) return false
    if (place === PLACE_BORROWED) return balle.borrowed_by !== null
    const segments = balle.borrowed_by ? null : segmentsFor(balle.emplacement_id)
    if (place === PLACE_UNPLACED) return balle.borrowed_by === null && segments === null
    if (!segments) return false
    const key = placeKey(segments)
    return key === place || key.startsWith(`${place}/`)
}

/** Libellé lisible d'une clé de lieu : « Zone B · Bags — R2 · Double haut ». */
export function placeLabel(place: string): string {
    if (place === PLACE_ALL) return "Tous les emplacements"
    if (place === PLACE_BORROWED) return "Empruntées"
    if (place === PLACE_UNPLACED) return "Non rangées"
    if (place === PLACE_ECLATEE) return "Éclatées"
    const [zone, row, ...rest] = place.split("/")
    const zoneInfo = PLAN_ZONES[zone as PlanZoneCode]
    let label = zoneInfo ? `Zone ${zone} · ${zoneInfo.label}` : `Zone ${zone}`
    if (row) {
        const rowLabel = PLAN_ROW_LABELS[row as PlanRow]
        label += ` — ${row}${rowLabel ? ` · ${rowLabel}` : ""}`
    }
    if (rest.length) label += ` · ${rest.join(" · ")}`
    return label
}

export interface PlaceGroup {
    key: string
    label: string
    balles: BalleHandpick[]
}

/** Ordre des zones : celui du plan, réserve d'abord. */
const ZONE_ORDER = ["B", "A", "D"]

const compareKeys = (a: string, b: string) => {
    const za = ZONE_ORDER.indexOf(a.split("/")[0])
    const zb = ZONE_ORDER.indexOf(b.split("/")[0])
    if (za !== zb) return (za === -1 ? 99 : za) - (zb === -1 ? 99 : zb)
    return a.localeCompare(b, "fr", { numeric: true })
}

/**
 * Groupes d'affichage : un par rack (ou par zone quand la zone n'a pas de
 * rack, comme A et D), puis les empruntées, puis les balles sans emplacement
 * réparties par situation (Réception, Tri…), et enfin les éclatées.
 *
 * Dans un groupe, les balles suivent l'ordre de leur chemin : E1 avant E2,
 * H0 avant H1.
 */
export function groupBallesByPlace(balles: BalleHandpick[], segmentsFor: SegmentsFor): PlaceGroup[] {
    const placed = new Map<string, { balle: BalleHandpick; path: string }[]>()
    const borrowed: BalleHandpick[] = []
    const unplaced = new Map<string, BalleHandpick[]>()
    const eclatees: BalleHandpick[] = []

    for (const balle of balles) {
        if (balle.is_eclatee) {
            eclatees.push(balle)
            continue
        }
        if (balle.borrowed_by) {
            borrowed.push(balle)
            continue
        }
        const segments = segmentsFor(balle.emplacement_id)
        if (!segments) {
            const key = balle.location ?? "none"
            unplaced.set(key, [...(unplaced.get(key) ?? []), balle])
            continue
        }
        // Rack quand le chemin en a un (zone/rangée/travée/hauteur), sinon zone.
        const key = placeKey(segments.length > 2 ? segments.slice(0, 2) : segments.slice(0, 1))
        placed.set(key, [...(placed.get(key) ?? []), { balle, path: placeKey(segments) }])
    }

    const groups: PlaceGroup[] = [...placed.keys()].sort(compareKeys).map((key) => ({
        key,
        label: placeLabel(key),
        balles: placed
            .get(key)!
            .sort((a, b) => a.path.localeCompare(b.path, "fr", { numeric: true }))
            .map((entry) => entry.balle),
    }))

    if (borrowed.length) groups.push({ key: PLACE_BORROWED, label: placeLabel(PLACE_BORROWED), balles: borrowed })

    const locationOrder = [...Object.keys(BALLE_LOCATION_LABELS), "none"]
    for (const location of locationOrder) {
        const list = unplaced.get(location)
        if (!list?.length) continue
        const situation =
            location === "none"
                ? "sans situation"
                : BALLE_LOCATION_LABELS[location as keyof typeof BALLE_LOCATION_LABELS].toLowerCase()
        groups.push({ key: `${PLACE_UNPLACED}:${location}`, label: `Non rangées — ${situation}`, balles: list })
    }

    if (eclatees.length) groups.push({ key: PLACE_ECLATEE, label: placeLabel(PLACE_ECLATEE), balles: eclatees })
    return groups
}

/**
 * Clés proposées dans le filtre « Emplacement » : chaque zone, puis chaque
 * rack de la zone, dans l'ordre du plan.
 */
export function placeFilterKeys(allSegments: readonly (readonly string[])[]): string[] {
    const keys = new Set<string>()
    for (const segments of allSegments) {
        if (segments[0]) keys.add(segments[0])
        if (segments.length > 2) keys.add(placeKey(segments.slice(0, 2)))
    }
    return [...keys].sort(compareKeys)
}
