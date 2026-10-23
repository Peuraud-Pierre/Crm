// Instantané du plan publié vers la console retail (contrat v1 de
// `PUT /api/v1/external/shops/:id/layout`). Retail ne fait que dessiner : il
// reçoit, étage par étage, les éléments déjà calculés par `buildPlanItems`.

import type {
    EmplacementMagasin,
    EquipementMagasin,
    Etage,
    Magasin,
    Mur,
    PlanItem,
    Point,
    ZoneMagasin,
} from "@/features/magasins/types/magasin.types"
import { buildPlanItems } from "./planTree"

export interface LayoutPayload {
    version: 1
    magasin: Pick<Magasin, "id" | "code" | "nom" | "largeur" | "profondeur">
    etages: {
        id: string
        nom: string
        niveau: number
        contour: Point[] | null
        items: PlanItem[]
        walls: Pick<Mur, "id" | "points" | "epaisseur" | "hauteur">[]
    }[]
}

export function buildLayoutPayload(
    magasin: Magasin,
    etages: readonly Etage[],
    zones: readonly ZoneMagasin[],
    emplacements: readonly EmplacementMagasin[],
    equipements: readonly EquipementMagasin[],
    murs: readonly Mur[],
): LayoutPayload {
    return {
        version: 1,
        magasin: {
            id: magasin.id,
            code: magasin.code,
            nom: magasin.nom,
            largeur: magasin.largeur,
            profondeur: magasin.profondeur,
        },
        etages: [...etages]
            .sort((a, b) => a.niveau - b.niveau)
            .map((etage) => {
                // Même découpage par étage que `usePlanMagasin` : un emplacement
                // suit l'étage de sa zone.
                const etageZones = zones.filter((z) => z.etage_id === etage.id)
                const zoneIds = new Set(etageZones.map((z) => z.id))
                return {
                    id: etage.id,
                    nom: etage.nom,
                    niveau: etage.niveau,
                    contour: etage.contour,
                    items: buildPlanItems(
                        etageZones,
                        emplacements.filter((e) => zoneIds.has(e.zone_id)),
                        equipements.filter((q) => q.etage_id === etage.id),
                    ),
                    walls: murs
                        .filter((m) => m.etage_id === etage.id)
                        .map(({ id, points, epaisseur, hauteur }) => ({ id, points, epaisseur, hauteur })),
                }
            }),
    }
}
