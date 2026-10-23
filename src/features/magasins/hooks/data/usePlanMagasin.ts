import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import * as planService from "@/features/magasins/services/planMagasinService"
import * as murService from "@/features/magasins/services/murService"
import { MUR_EPAISSEUR_DEFAUT } from "@/features/magasins/constants"
import type { GeometryChange } from "@/features/magasins/services/planMagasinService"
import { magasinErrorMessage } from "@/features/magasins/utils/crudErrors"
import { buildPlanItems, buildZoneTree, nextEquipementCode } from "@/features/magasins/utils/planTree"
import { geometryOf } from "@/features/magasins/utils/planGeometry"
import { shapeFromPoints } from "@/features/magasins/utils/shape"
import { autoZoneLinks, zoneUnder } from "@/features/magasins/utils/mannequin"
import { EQUIPEMENT_KIND_LABEL } from "@/features/magasins/constants"
import type {
    EmplacementFormInput,
    EmplacementMagasin,
    EquipementKind,
    EquipementMagasin,
    Mur,
    MurPatch,
    PlanGeometry,
    Point,
    ZoneFormInput,
    ZoneMagasin,
} from "@/features/magasins/types/magasin.types"

/**
 * Plan d'un magasin : zones, emplacements, leurs vues dérivées (arbre, liste
 * dessinable) et les mutations. Partagé par les onglets Plan et Emplacements
 * via `MagasinDetail`, pour qu'un ajout dans l'un apparaisse dans l'autre sans
 * rechargement.
 *
 * Tout le magasin est chargé (un plan tient en mémoire) ; ce qui est renvoyé
 * est l'ÉTAGE affiché, et les créations s'y rangent. `contentOf` compte le
 * contenu de n'importe quel étage, pour confirmer sa suppression.
 */
export function usePlanMagasin(magasinId: string, etageId: string | null) {
    const [allZones, setAllZones] = useState<ZoneMagasin[]>([])
    const [allEmplacements, setAllEmplacements] = useState<EmplacementMagasin[]>([])
    const [allEquipements, setAllEquipements] = useState<EquipementMagasin[]>([])
    const [allMurs, setAllMurs] = useState<Mur[]>([])
    // Murs illisibles (table absente : migration des murs non passée). Le
    // reste du plan reste utilisable ; seul l'outil Mur est indisponible.
    const [mursUnavailable, setMursUnavailable] = useState(false)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const requestRef = useRef(0)

    const refetch = useCallback(async () => {
        const request = ++requestRef.current
        try {
            // Les murs à part : leur échec ne doit pas emporter le plan entier
            // (un ajout réussi n'apparaissait plus, son rechargement échouant).
            const [[z, e, q], murs] = await Promise.all([
                Promise.all([
                    planService.fetchZones(magasinId),
                    planService.fetchEmplacements(magasinId),
                    planService.fetchEquipements(magasinId),
                ]),
                murService.fetchMurs(magasinId).then(
                    (rows) => ({ ok: true as const, rows }),
                    (err: unknown) => ({ ok: false as const, err }),
                ),
            ])
            if (request !== requestRef.current) return
            if (!murs.ok) console.error(murs.err)
            setMursUnavailable(!murs.ok)
            const m = murs.ok ? murs.rows : []
            setAllZones(z)
            setAllEmplacements(e)
            setAllEquipements(q)
            setAllMurs(m)
            setError(null)
        } catch (err) {
            if (request !== requestRef.current) return
            console.error(err)
            setError("Impossible de charger le plan du magasin.")
        } finally {
            if (request === requestRef.current) setLoading(false)
        }
    }, [magasinId])

    // Un autre magasin remonte la fiche (`key` dans la route) : `loading`
    // repart donc de `true` sans être remis à zéro ici.
    useEffect(() => {
        void refetch()
    }, [refetch])

    // L'étage affiché : ses zones, les emplacements de ces zones, ses équipements.
    const zones = useMemo(() => allZones.filter((z) => z.etage_id === etageId), [allZones, etageId])
    const emplacements = useMemo(() => {
        const ids = new Set(zones.map((z) => z.id))
        return allEmplacements.filter((e) => ids.has(e.zone_id))
    }, [allEmplacements, zones])
    const equipements = useMemo(() => allEquipements.filter((q) => q.etage_id === etageId), [allEquipements, etageId])
    const murs = useMemo(() => allMurs.filter((m) => m.etage_id === etageId), [allMurs, etageId])

    const contentOf = useCallback(
        (id: string) => {
            const ids = new Set(allZones.filter((z) => z.etage_id === id).map((z) => z.id))
            return {
                zones: ids.size,
                emplacements: allEmplacements.filter((e) => ids.has(e.zone_id)).length,
                equipements: allEquipements.filter((q) => q.etage_id === id).length,
                murs: allMurs.filter((m) => m.etage_id === id).length,
            }
        },
        [allZones, allEmplacements, allEquipements, allMurs],
    )

    const tree = useMemo(() => buildZoneTree(zones, emplacements), [zones, emplacements])
    const items = useMemo(
        () => buildPlanItems(zones, emplacements, equipements),
        [zones, emplacements, equipements],
    )

    /** Exécute une mutation, recharge le plan, et annonce le résultat. */
    const run = useCallback(
        async <T>(
            entity: string,
            action: "create" | "update" | "delete",
            fn: () => Promise<T>,
            success: string,
        ): Promise<T | null> => {
            try {
                const result = await fn()
                toast.success(success)
                await refetch()
                return result
            } catch (err) {
                console.error(err)
                toast.error(magasinErrorMessage(entity, action, err))
                return null
            }
        },
        [refetch],
    )

    const createZone = useCallback(
        (input: ZoneFormInput & Partial<PlanGeometry> & { forme?: Point[] | null }) =>
            run(
                "de la zone",
                "create",
                () => {
                    if (!etageId) throw new Error("Aucun étage sélectionné")
                    return planService.insertZone(magasinId, { ...input, etage_id: etageId })
                },
                `« ${input.code} » créé`,
            ),
        [run, magasinId, etageId],
    )
    const updateZone = useCallback(
        async (id: string, input: Partial<ZoneFormInput>) =>
            (await run("de la zone", "update", () => planService.patchZone(id, input).then(() => true), "Enregistré")) ??
            false,
        [run],
    )
    /**
     * Angles d'une zone ou d'un équipement retouchés (en mètres) : nouveau
     * rectangle englobant et tracé relatif. `null` : redevenir un rectangle,
     * dans le rectangle actuel.
     */
    const updateShape = useCallback(
        async (target: { type: "zone" | "equipement"; id: string; geometry: PlanGeometry }, points: readonly Point[] | null) => {
            const entity = target.type === "zone" ? "de la zone" : "de l'équipement"
            const geometry = points ? geometryOf(shapeFromPoints(points).rect, target.geometry.rotation) : target.geometry
            const forme = points ? shapeFromPoints(points).forme : null
            return (
                (await run(
                    entity,
                    "update",
                    () => planService.patchShape(target.type, target.id, geometry, forme).then(() => true),
                    points ? "Forme enregistrée" : "Redevenu rectangle",
                )) ?? false
            )
        },
        [run],
    )
    const removeZone = useCallback(
        async (id: string) =>
            (await run("de la zone", "delete", () => planService.removeZone(id).then(() => true), "Supprimé")) ?? false,
        [run],
    )
    const createEmplacement = useCallback(
        (input: EmplacementFormInput) =>
            run(
                "de l'emplacement",
                "create",
                () => planService.insertEmplacement(magasinId, input),
                `Emplacement « ${input.code} » créé`,
            ),
        [run, magasinId],
    )
    const updateEmplacement = useCallback(
        async (id: string, input: Partial<EmplacementFormInput>) =>
            (await run(
                "de l'emplacement",
                "update",
                () => planService.patchEmplacement(id, input).then(() => true),
                "Emplacement enregistré",
            )) ?? false,
        [run],
    )
    const removeEmplacement = useCallback(
        async (id: string) =>
            (await run(
                "de l'emplacement",
                "delete",
                () => planService.removeEmplacement(id).then(() => true),
                "Emplacement supprimé",
            )) ?? false,
        [run],
    )
    const createEquipement = useCallback(
        (kind: EquipementKind, geometry: PlanGeometry, zoneId: string | null = null) => {
            const code = nextEquipementCode(kind, equipements)
            // Un mannequin posé dans une zone s'y rattache d'emblée.
            const zone = zoneId ?? (kind === "mannequin" ? zoneUnder(geometry, items) : null)
            return run(
                "de l'équipement",
                "create",
                () => {
                    if (!etageId) throw new Error("Aucun étage sélectionné")
                    return planService.insertEquipement(magasinId, etageId, kind, code, geometry, zone)
                },
                `Nouvel équipement : ${EQUIPEMENT_KIND_LABEL[kind]} ${code}`,
            )
        },
        [run, magasinId, etageId, equipements, items],
    )
    /** Rattache un mannequin à une zone, un rayon ou un portant ; `null` le détache. */
    const linkEquipementZone = useCallback(
        (id: string, zoneId: string | null) =>
            run(
                "du mannequin",
                "update",
                () => planService.setEquipementZone(id, zoneId).then(() => true),
                zoneId ? "Mannequin rattaché" : "Mannequin détaché",
            ),
        [run],
    )
    const removeEquipement = useCallback(
        async (id: string) =>
            (await run(
                "de l'équipement",
                "delete",
                () => planService.removeEquipement(id).then(() => true),
                "Équipement supprimé",
            )) ?? false,
        [run],
    )
    /** Fusionne des volées en un seul escalier (elles rejoignent un groupe existant). */
    const mergeEquipements = useCallback(
        (ids: readonly string[]) => {
            const groupe = allEquipements.find((q) => ids.includes(q.id) && q.groupe)?.groupe ?? crypto.randomUUID()
            return run(
                "de l'escalier",
                "update",
                () => planService.setGroupe(ids, groupe).then(() => true),
                "Escaliers fusionnés",
            )
        },
        [run, allEquipements],
    )
    const ungroupEquipements = useCallback(
        (groupe: string) => {
            const ids = allEquipements.filter((q) => q.groupe === groupe).map((q) => q.id)
            return run("de l'escalier", "update", () => planService.setGroupe(ids, null).then(() => true), "Escalier séparé")
        },
        [run, allEquipements],
    )
    const setStairsDescend = useCallback(
        (ids: readonly string[], descend: boolean) =>
            run(
                "de l'escalier",
                "update",
                () => planService.setDescend(ids, descend).then(() => true),
                descend ? "Escalier qui descend" : "Escalier qui monte",
            ),
        [run],
    )
    const removeEquipements = useCallback(
        async (ids: readonly string[]) =>
            (await run(
                "de l'escalier",
                "delete",
                () => planService.removeEquipements(ids).then(() => true),
                "Escalier supprimé",
            )) ?? false,
        [run],
    )
    const createMur = useCallback(
        (points: Point[], epaisseur: number = MUR_EPAISSEUR_DEFAUT) =>
            run(
                "du mur",
                "create",
                () => {
                    if (!etageId) throw new Error("Aucun étage sélectionné")
                    return murService.insertMur(magasinId, etageId, points, epaisseur)
                },
                "Mur ajouté",
            ),
        [run, magasinId, etageId],
    )
    /** Appliqué tout de suite (points glissés, épaisseur), puis enregistré. */
    const updateMur = useCallback(
        async (id: string, patch: MurPatch): Promise<boolean> => {
            setAllMurs((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)))
            try {
                await murService.patchMur(id, patch)
                return true
            } catch (err) {
                console.error(err)
                toast.error(magasinErrorMessage("du mur", "update", err))
                await refetch()
                return false
            }
        },
        [refetch],
    )
    const removeMur = useCallback(
        async (id: string) =>
            (await run("du mur", "delete", () => murService.removeMur(id).then(() => true), "Mur supprimé")) ?? false,
        [run],
    )
    const saveGeometries = useCallback(
        async (changes: readonly GeometryChange[]) =>
            changes.length === 0
                ? true
                : ((await run(
                      "du plan",
                      "update",
                      async () => {
                          await planService.saveGeometries(changes)
                          // Mannequins posés dans une zone sans en avoir : rattachés.
                          const links = autoZoneLinks(changes, equipements, items)
                          await Promise.all(links.map((l) => planService.setEquipementZone(l.id, l.zoneId)))
                          return true
                      },
                      "Plan enregistré",
                  )) ?? false),
        [run, equipements, items],
    )

    return {
        zones,
        emplacements,
        equipements,
        murs,
        mursUnavailable,
        tree,
        items,
        contentOf,
        loading,
        error,
        refetch,
        createZone,
        updateZone,
        updateShape,
        removeZone,
        createEmplacement,
        updateEmplacement,
        removeEmplacement,
        createEquipement,
        linkEquipementZone,
        removeEquipement,
        mergeEquipements,
        ungroupEquipements,
        setStairsDescend,
        removeEquipements,
        createMur,
        updateMur,
        removeMur,
        saveGeometries,
    }
}

export type PlanMagasinApi = ReturnType<typeof usePlanMagasin>
