import type { PlanRow, PlanZoneCode } from "./planLayout"

/**
 * Plan d'étage de l'entrepôt, relevé sur le tableau (IMG_2287), en MÈTRES.
 * Disposition PAR DÉFAUT : la vue 2D (SVG) et la vue 3D lisent la disposition
 * enregistrée en base, et retombent sur celle-ci tant qu'aucune n'a été
 * enregistrée depuis l'éditeur de l'onglet Plan.
 *
 *   x → vers la droite, z ↓ vers le bas du plan. Origine : coin haut-gauche.
 *
 *   ┌─────────────── B (réserve) ─────┬──┬▌▌──────── A (annexe) ──────┐
 *   │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓ R1 ▓▓▓▓▓▓▓▓▓▓▓  │R5│//│  ░░░░░░░░       ░░░░░░ │
 *   │  ▓▓▓▓▓▓▓▓▓▓▓ R2 ▓▓▓▓▓▓▓▓▓▓▓    │▓▓│//│  [machine]      ░░░░░░ │
 *   │  ▓▓▓▓▓▓▓▓▓▓▓ R3 ▓▓▓▓▓▓▓▓▓▓▓    │▓▓│//│                      ▓ │
 * ▌ │                                  │▓▓│//│ ● tables de jeans    ▓ │
 * ▌ │ ◙ ◙  ▓▓▓▓▓▓ R4 ▓▓▓▓▓▓           │▓▓│//│                   ▓▓▓▓ │
 *   └──────────────────────┐                                 ├ Bureau 1 ┤
 *                          │ portants     D (boutique)       ├ Bureau 2 ┤
 *                          │ muraux                          │          │
 *                          │                                 │          │
 *                          └──────▌▌──────▌▌▌▌▌▌▌▌──────────┴──────────┘
 *
 *   ▓ racks (rouge) · Bureau (bleu) · ▌ portes d'entrée / sortie (noir)
 *
 * R2 et R3 sont les deux faces du rack double, dos à dos. ◙ : machines à laver.
 * // : passerelle de l'annexe, à la place de l'ancien escalier.
 *
 * Les racks R1…R5 sont adressables (B · R2 · E3 · H1) ; les petits racks de
 * l'annexe sont dessinés mais n'ont pas d'emplacement en base.
 */

export interface Rect {
    x: number
    z: number
    w: number
    d: number
}

export interface RackSpec {
    id: string
    /** Rangée adressable, ou `null` pour un rack seulement dessiné. */
    row: PlanRow | null
    rect: Rect
    /** Sens de la longueur, donc de la succession des travées. */
    axis: "x" | "z"
    /** Rendu 3D : rack à palettes (défaut) ou étagère à chaussures. */
    style?: "pallet" | "shoes"
    /** Angle en degrés, sens horaire sur le plan, autour du centre. */
    rotation?: number
}

export interface DoorSpec {
    id: string
    /** Segment de mur occupé par la porte. */
    from: [number, number]
    to: [number, number]
    label: string
}

export interface InnerWallSpec {
    id: string
    tone: "white" | "black"
    /** Fresque « NOKK_PROJECT VINTAGE » sur la face est. */
    mural: boolean
    from: [number, number]
    to: [number, number]
}

export type FixtureKind =
    | "platform" | "storage" | "displayWall" | "room" | "washer"
    // Mobilier de la boutique (photos de la zone D)
    | "island" | "shopTable" | "bagStack" | "wireBin" | "trolley" | "clearBin" | "mannequin"
    // Annexe (photos de la zone A)
    | "walkway" | "machine" | "denimTable" | "roundTable" | "jeansRail" | "guard" | "shoeShelf"
    // Mobilier courant
    | "sofa" | "table"

export interface FixtureSpec {
    id: string
    kind: FixtureKind
    rect: Rect
    label?: string
    /** Sens de la longueur, pour les meubles orientables (îlots, portants). */
    axis?: "x" | "z"
    /** Angle en degrés, sens horaire sur le plan, autour du centre. */
    rotation?: number
}

export interface OfficeSpec {
    id: string
    label: string
    rect: Rect
    /** Angle en degrés, sens horaire sur le plan, autour du centre. */
    rotation?: number
}

export interface PillarSpec {
    id: string
    x: number
    z: number
}

/**
 * Disposition complète de l'entrepôt. Enregistrée en base
 * (`plan_layout_handpick`) et modifiable depuis l'onglet Plan ; à défaut,
 * `DEFAULT_FLOOR` fait foi.
 */
export interface FloorLayout {
    width: number
    depth: number
    /** Contour des murs, sens horaire. */
    outline: [number, number][]
    zones: Record<PlanZoneCode, Rect>
    racks: RackSpec[]
    offices: OfficeSpec[]
    doors: DoorSpec[]
    fixtures: FixtureSpec[]
    /** Où poser les balles « au sol » de A et D. */
    baleSpots: Record<"A" | "D", { x: number; z: number }>
    pillars: PillarSpec[]
    innerWalls: InnerWallSpec[]
    /** Décor suspendu (3D seulement) : l'avion de la boutique. */
    plane: { x: number; y: number; z: number }
}

export const DEFAULT_FLOOR: FloorLayout = {
    width: 32.7,
    depth: 33.3,

    /** Contour des murs, sens horaire. */
    outline: [
        [0, 0], [31.7, 0], [31.7, 11.4], [32.7, 11.4],
        [32.7, 33.3], [12.3, 33.3], [12.3, 11.4], [0, 11.4],
    ],

    zones: {
        B: { x: 0, z: 0, w: 18.3, d: 11.4 },
        A: { x: 18.3, z: 0, w: 13.4, d: 11.4 },
        D: { x: 12.3, z: 11.4, w: 15.9, d: 21.9 },
    },

    racks: [
        { id: "R1", row: "R1", axis: "x", rect: { x: 1.2, z: 0.3, w: 13.9, d: 1.2 } },
        // Rack double : deux faces dos à dos, une rangée chacune.
        { id: "R2", row: "R2", axis: "x", rect: { x: 1.9, z: 3.0, w: 12.2, d: 1.2 } },
        { id: "R3", row: "R3", axis: "x", rect: { x: 1.9, z: 4.2, w: 12.2, d: 1.2 } },
        { id: "R4", row: "R4", axis: "x", rect: { x: 4.5, z: 9.9, w: 7.8, d: 1.2 } },
        { id: "R5", row: "R5", axis: "z", rect: { x: 16.6, z: 0.3, w: 1.2, d: 9.8 } },
        // Annexe : étagères à chaussures (photos), dessinées comme des racks.
        { id: "A-rack-1", row: null, style: "shoes", axis: "z", rect: { x: 31.0, z: 6.3, w: 0.6, d: 1.2 } },
        { id: "A-rack-2", row: null, style: "shoes", axis: "z", rect: { x: 31.0, z: 7.8, w: 0.6, d: 2.6 } },
        { id: "A-rack-3", row: null, style: "shoes", axis: "x", rect: { x: 28.2, z: 10.8, w: 3.4, d: 0.5 } },
    ],

    offices: [
        { id: "bureau-1", label: "Bureau 1", rect: { x: 28.2, z: 11.6, w: 4.5, d: 3.8 } },
        { id: "bureau-2", label: "Bureau 2", rect: { x: 28.2, z: 15.4, w: 4.5, d: 3.8 } },
    ],

    doors: [
        { id: "porte-annexe", label: "Accès annexe", from: [18.6, 0], to: [20.5, 0] },
        { id: "porte-reserve", label: "Entrée / sortie réserve", from: [0, 6.6], to: [0, 11.1] },
        { id: "porte-service", label: "Porte de service", from: [17, 33.3], to: [18.6, 33.3] },
        { id: "porte-boutique", label: "Entrée boutique", from: [21, 33.3], to: [27.6, 33.3] },
    ],

    fixtures: [

        // ── Annexe : d'après les photos de la zone A ──
        // Passerelle en pente le long de la cloison ouest, là où le croquis
        // montrait l'escalier : de l'accès du haut jusqu'à la boutique.
        { id: "passerelle", kind: "walkway", label: "Passerelle", axis: "z", rect: { x: 18.6, z: 0.3, w: 1.9, d: 11.0 } },
        //
        // Mobilier disposé exactement comme sur la photo prise depuis le bas
        // de la rampe (IMG_2288), en lisant du premier plan vers le fond :
        //  · deux protections rouges encadrent le passage vers la boutique ;
        //  · contre la rambarde droite : un long banc bas couvert de jeans,
        //    une table plus petite, puis une petite table de piles blanches ;
        //  · la colonne EPV, et derrière elle l'escalier de la machine qui
        //    monte vers le fond le long de sa face ouest ;
        //  · au centre, un portant de jeans suspendus ; à sa droite, une table
        //    de jeans ;
        //  · à droite, l'étagère à chaussures devant le mur noir ;
        //  · au fond, la machine rouge.
        { id: "protection-ouest", kind: "guard", rect: { x: 18.35, z: 10.9, w: 0.15, d: 0.5 } },
        { id: "protection-est", kind: "guard", rect: { x: 20.8, z: 10.9, w: 0.15, d: 0.5 } },
        { id: "banc-jeans", kind: "denimTable", axis: "z", rect: { x: 20.75, z: 8.5, w: 0.8, d: 2.1 } },
        { id: "table-jeans", kind: "denimTable", axis: "z", rect: { x: 20.8, z: 7.1, w: 0.7, d: 1.1 } },
        { id: "table-piles", kind: "denimTable", rect: { x: 20.8, z: 6.1, w: 0.8, d: 0.7 } },
        { id: "machine", kind: "machine", label: "Machine", rect: { x: 20.8, z: 0.6, w: 5.2, d: 5.0 } },
        { id: "portant-jeans", kind: "jeansRail", rect: { x: 22.9, z: 6.6, w: 1.5, d: 0.5 } },
        { id: "table-ronde", kind: "roundTable", rect: { x: 24.8, z: 6.9, w: 1.0, d: 1.0 } },
        { id: "etagere-chaussures", kind: "shoeShelf", axis: "z", rect: { x: 26.7, z: 4.6, w: 0.5, d: 2.6 } },
        // Derrière le mur noir : stockage de l'annexe.
        { id: "annexe-stock-2", kind: "storage", rect: { x: 29.4, z: 0.6, w: 2.1, d: 5.4 } },
        { id: "portants-muraux", kind: "displayWall", label: "Portants", axis: "z", rect: { x: 12.4, z: 13.5, w: 1.6, d: 19.6 } },
        { id: "portants-droite", kind: "displayWall", axis: "z", rect: { x: 31.3, z: 19.6, w: 1.3, d: 10.8 } },

        // ── Boutique : d'après les photos de la zone D ──
        // Deux rangées d'îlots entre les colonnes, dans le sens de la salle…
        { id: "ilot-1", kind: "island", axis: "z", rect: { x: 17.35, z: 15.4, w: 1.3, d: 3.2 } },
        { id: "ilot-2", kind: "island", axis: "z", rect: { x: 17.35, z: 20.4, w: 1.3, d: 3.2 } },
        { id: "ilot-3", kind: "island", axis: "z", rect: { x: 23.85, z: 15.4, w: 1.3, d: 3.2 } },
        { id: "ilot-4", kind: "island", axis: "z", rect: { x: 23.85, z: 20.4, w: 1.3, d: 3.2 } },
        // …et deux en travers, au centre.
        { id: "ilot-5", kind: "island", axis: "x", rect: { x: 19.65, z: 13.9, w: 3.2, d: 1.3 } },
        { id: "ilot-6", kind: "island", axis: "x", rect: { x: 19.65, z: 21.4, w: 3.2, d: 1.3 } },
        // Côté porte (photo prise depuis l'entrée) : deux tables de t-shirts
        // dans le sens de la salle, un îlot avec le buste à droite.
        { id: "table-1", kind: "shopTable", axis: "z", rect: { x: 17.65, z: 27.2, w: 1.1, d: 2.4 } },
        { id: "table-2", kind: "shopTable", axis: "z", rect: { x: 21.65, z: 27.2, w: 1.1, d: 2.4 } },
        { id: "ilot-entree", kind: "island", axis: "x", rect: { x: 25.4, z: 25.85, w: 3.2, d: 1.3 } },
        { id: "sacs-1", kind: "bagStack", rect: { x: 18.8, z: 24.0, w: 1.2, d: 1.0 } },
        { id: "sacs-2", kind: "bagStack", rect: { x: 25.3, z: 13.9, w: 1.2, d: 1.0 } },
        { id: "sacs-3", kind: "bagStack", rect: { x: 14.6, z: 18.4, w: 1.2, d: 1.0 } },
        { id: "bac-fripes", kind: "wireBin", rect: { x: 22.9, z: 24.3, w: 1.2, d: 0.9 } },
        { id: "desserte", kind: "trolley", rect: { x: 20.6, z: 25.4, w: 1.2, d: 0.7 } },
        { id: "poubelle-1", kind: "clearBin", rect: { x: 18.7, z: 13.8, w: 0.5, d: 0.5 } },
        { id: "poubelle-2", kind: "clearBin", rect: { x: 25.2, z: 19.3, w: 0.5, d: 0.5 } },
        { id: "poubelle-3", kind: "clearBin", rect: { x: 16.9, z: 24.3, w: 0.5, d: 0.5 } },
        { id: "mannequin", kind: "mannequin", rect: { x: 27.8, z: 24.9, w: 0.6, d: 0.6 } },
        // Les deux statues au pied de la colonne centrale (photo depuis les bureaux).
        { id: "mannequin-2", kind: "mannequin", rect: { x: 25.1, z: 24.1, w: 0.6, d: 0.6 } },
        { id: "local-bas", kind: "room", rect: { x: 28.2, z: 30.6, w: 4.4, d: 1.2 } },
        { id: "lave-linge-1", kind: "washer", label: "Machines à laver", rect: { x: 1.4, z: 10.2, w: 0.9, d: 0.9 } },
        { id: "lave-linge-2", kind: "washer", rect: { x: 2.8, z: 10.2, w: 0.9, d: 0.9 } },
    ],

    /** Où poser les balles « au sol » de A et D. */
    baleSpots: {
        A: { x: 24.2, z: 9.6 },
        D: { x: 16.2, z: 30.8 },
    },

    /** Colonnes en fonte : allée de la réserve, deux rangées dans la boutique. */
    pillars: [
        { id: "colonne-1", x: 5.5, z: 7.4 },
        { id: "colonne-2", x: 10.5, z: 7.4 },
        { id: "colonne-3", x: 15.2, z: 7.4 },
        { id: "colonne-4", x: 18, z: 14.5 },
        { id: "colonne-5", x: 18, z: 19.5 },
        { id: "colonne-6", x: 18, z: 24.5 },
        { id: "colonne-7", x: 24.5, z: 14.5 },
        { id: "colonne-8", x: 24.5, z: 19.5 },
        { id: "colonne-9", x: 24.5, z: 24.5 },
        // Annexe : au bord de la rampe, au pied de l'escalier de la machine.
        { id: "colonne-10", x: 21.95, z: 6.25 },
        // Premier plan de la photo, de part et d'autre de l'entrée.
        { id: "colonne-11", x: 15.2, z: 28 },
        { id: "colonne-12", x: 26.8, z: 28.4 },
    ],

    /** Cloisons intérieures : la blanche de la rampe porte la fresque. */
    innerWalls: [
        { id: "cloison-annexe", tone: "white", mural: true, from: [18.4, 0], to: [18.4, 9] },
        { id: "mur-noir", tone: "black", mural: false, from: [27.4, 0], to: [27.4, 8.2] },
    ],

    /** Décor suspendu (3D seulement) : l'avion de la boutique. */
    plane: { x: 21.2, y: 4.4, z: 19 },
}

/**
 * Points de vue 3D des photos du site. Ils ne font pas partie de la
 * disposition éditable : ce sont des cadrages, pas des meubles.
 */
export const FLOOR_VIEWS = {
    entrance: {
        label: "Depuis l'entrée",
        camera: [24.3, 12, 43] as [number, number, number],
        target: [21, 0.5, 15] as [number, number, number],
    },
    annexFromShop: {
        label: "Annexe depuis la rampe",
        camera: [20.2, 1.8, 13.2] as [number, number, number],
        target: [22.6, 1.6, 1.5] as [number, number, number],
    },
    annex: {
        label: "Passerelle de l'annexe",
        camera: [19.55, 3.1, 0.8] as [number, number, number],
        target: [20.2, 1.0, 14] as [number, number, number],
    },
    offices: {
        label: "Depuis les bureaux",
        camera: [31, 11, 12] as [number, number, number],
        target: [20.5, 0.5, 30] as [number, number, number],
    },
}

/**
 * Rotation d'un point du plan autour de `(cx, cz)`, de `degrees` dans le sens
 * horaire à l'écran (z vers le bas) — la même convention que `rotate()` en SVG.
 */
export function rotatePoint(x: number, z: number, cx: number, cz: number, degrees: number) {
    const a = (degrees * Math.PI) / 180
    const dx = x - cx
    const dz = z - cz
    return { x: cx + dx * Math.cos(a) - dz * Math.sin(a), z: cz + dx * Math.sin(a) + dz * Math.cos(a) }
}

/** Travées d'un rack : rectangles successifs le long de son axe (hors angle). */
export function bayRects(rack: RackSpec, count: number): Rect[] {
    const { rect } = rack
    return Array.from({ length: count }, (_, i) =>
        rack.axis === "x"
            ? { x: rect.x + (i * rect.w) / count, z: rect.z, w: rect.w / count, d: rect.d }
            : { x: rect.x, z: rect.z + (i * rect.d) / count, w: rect.w, d: rect.d / count },
    )
}
