import type { FixtureKind, FloorLayout, Rect } from "./floorPlan"
import { round, snap, type ElementRef } from "./floorPlanEdit"

/**
 * Catalogue des éléments qu'on peut ajouter au plan, et leur création.
 * Chaque meuble ajouté reprend les dimensions de son modèle ; l'utilisateur
 * l'ajuste ensuite depuis l'éditeur.
 */

export interface AddTemplate {
    id: string
    label: string
    group: "Structure" | "Réserve" | "Boutique" | "Annexe"
}

interface FixtureTemplate {
    kind: FixtureKind
    label: string
    group: AddTemplate["group"]
    w: number
    d: number
    axis?: "x" | "z"
    /** Libellé posé sur l'élément ajouté, visible sur le plan 2D. */
    tag?: string
}

const FIXTURE_TEMPLATES: FixtureTemplate[] = [
    { kind: "storage", label: "Zone de sacs", group: "Réserve", w: 2, d: 1.5 },
    { kind: "washer", label: "Machine à laver", group: "Réserve", w: 0.9, d: 0.9 },
    { kind: "island", label: "Îlot de portants", group: "Boutique", w: 3.2, d: 1.3, axis: "x" },
    { kind: "displayWall", label: "Portant mural", group: "Boutique", w: 6, d: 1.3, axis: "x" },
    { kind: "shopTable", label: "Table de t-shirts", group: "Boutique", w: 2.4, d: 1.1 },
    { kind: "bagStack", label: "Pile de sacs verts", group: "Boutique", w: 1.2, d: 1.0 },
    { kind: "wireBin", label: "Bac grillagé", group: "Boutique", w: 1.2, d: 0.9 },
    { kind: "trolley", label: "Desserte", group: "Boutique", w: 1.2, d: 0.7 },
    { kind: "clearBin", label: "Poubelle", group: "Boutique", w: 0.5, d: 0.5 },
    { kind: "mannequin", label: "Mannequin", group: "Boutique", w: 0.6, d: 0.6 },
    { kind: "room", label: "Local", group: "Structure", w: 3, d: 2.4 },
    { kind: "sofa", label: "Canapé", group: "Structure", w: 2.2, d: 0.95, tag: "Canapé" },
    { kind: "table", label: "Table", group: "Structure", w: 1.8, d: 0.9, tag: "Table" },
    { kind: "platform", label: "Estrade", group: "Annexe", w: 4, d: 3 },
    { kind: "walkway", label: "Passerelle", group: "Annexe", w: 1.9, d: 8, axis: "z" },
    { kind: "machine", label: "Machine industrielle", group: "Annexe", w: 5.2, d: 5 },
    { kind: "denimTable", label: "Table de jeans", group: "Annexe", w: 1.2, d: 0.7 },
    { kind: "roundTable", label: "Table ronde", group: "Annexe", w: 1, d: 1 },
    { kind: "jeansRail", label: "Portant de jeans", group: "Annexe", w: 1.5, d: 0.5 },
    { kind: "shoeShelf", label: "Étagère à chaussures", group: "Annexe", w: 2.4, d: 0.5, axis: "x" },
    { kind: "guard", label: "Protection rouge", group: "Annexe", w: 0.15, d: 0.5 },
]

export const ADD_TEMPLATES: AddTemplate[] = [
    { id: "rack", label: "Rack à palettes", group: "Réserve" },
    { id: "office", label: "Bureau", group: "Structure" },
    { id: "door", label: "Porte", group: "Structure" },
    { id: "wall", label: "Cloison", group: "Structure" },
    { id: "pillar", label: "Colonne EPV", group: "Structure" },
    ...FIXTURE_TEMPLATES.map((t) => ({ id: `fixture:${t.kind}`, label: t.label, group: t.group })),
]

/** Identifiant libre, lisible : `ilot-3`, `porte-2`… */
function freshId(floor: FloorLayout, prefix: string): string {
    const taken = new Set<string>([
        ...floor.racks.map((x) => x.id),
        ...floor.fixtures.map((x) => x.id),
        ...floor.offices.map((x) => x.id),
        ...floor.pillars.map((x) => x.id),
        ...floor.doors.map((x) => x.id),
        ...floor.innerWalls.map((x) => x.id),
    ])
    let i = 1
    while (taken.has(`${prefix}-${i}`)) i++
    return `${prefix}-${i}`
}

/**
 * Ajoute un élément centré sur `at` et rend sa référence, pour que l'éditeur
 * le sélectionne aussitôt.
 */
export function addElement(
    floor: FloorLayout,
    templateId: string,
    at: { x: number; z: number },
): { floor: FloorLayout; ref: ElementRef } | null {
    const rectAt = (w: number, d: number): Rect => ({
        x: round(snap(at.x - w / 2)),
        z: round(snap(at.z - d / 2)),
        w,
        d,
    })
    const px = round(snap(at.x))
    const pz = round(snap(at.z))

    if (templateId === "rack") {
        const id = freshId(floor, "rack")
        return {
            floor: { ...floor, racks: [...floor.racks, { id, row: null, axis: "x", rect: rectAt(5.4, 1.2) }] },
            ref: { kind: "rack", id },
        }
    }
    if (templateId === "office") {
        const id = freshId(floor, "bureau")
        const label = `Bureau ${floor.offices.length + 1}`
        return {
            floor: { ...floor, offices: [...floor.offices, { id, label, rect: rectAt(4, 3.5) }] },
            ref: { kind: "office", id },
        }
    }
    if (templateId === "door") {
        const id = freshId(floor, "porte")
        return {
            floor: {
                ...floor,
                doors: [...floor.doors, { id, label: "Porte", from: [round(px - 1), pz], to: [round(px + 1), pz] }],
            },
            ref: { kind: "door", id },
        }
    }
    if (templateId === "wall") {
        const id = freshId(floor, "cloison")
        return {
            floor: {
                ...floor,
                innerWalls: [
                    ...floor.innerWalls,
                    { id, tone: "white", mural: false, from: [round(px - 2), pz], to: [round(px + 2), pz] },
                ],
            },
            ref: { kind: "wall", id },
        }
    }
    if (templateId === "pillar") {
        const id = freshId(floor, "colonne")
        return { floor: { ...floor, pillars: [...floor.pillars, { id, x: px, z: pz }] }, ref: { kind: "pillar", id } }
    }
    const kind = templateId.startsWith("fixture:") ? (templateId.slice("fixture:".length) as FixtureKind) : null
    const template = FIXTURE_TEMPLATES.find((t) => t.kind === kind)
    if (!template) return null
    const id = freshId(floor, template.kind)
    return {
        floor: {
            ...floor,
            fixtures: [
                ...floor.fixtures,
                {
                    id,
                    kind: template.kind,
                    axis: template.axis,
                    label: template.tag,
                    rect: rectAt(template.w, template.d),
                },
            ],
        },
        ref: { kind: "fixture", id },
    }
}
