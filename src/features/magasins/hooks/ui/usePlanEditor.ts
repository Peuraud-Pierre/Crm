import { useCallback, useMemo, useState } from "react"
import type { GeometryChange } from "@/features/magasins/services/planMagasinService"
import type { PlanGeometry, PlanItem } from "@/features/magasins/types/magasin.types"
import {
    geometryOf,
    initialRect,
    normalizeRotation,
    rectOf,
    sameGeometry,
    type Bounds,
    type Rect,
} from "@/features/magasins/utils/planGeometry"

/**
 * Brouillon de l'éditeur de plan : les géométries modifiées, par clé
 * d'élément, au-dessus de celles enregistrées. Rien ne part en base avant
 * « Enregistrer » ; « Annuler » jette le brouillon.
 */
export function usePlanEditor(items: readonly PlanItem[], bounds: Bounds) {
    const [draft, setDraft] = useState<Record<string, PlanGeometry>>({})

    const geometryFor = useCallback(
        (item: PlanItem): PlanGeometry => draft[item.key] ?? item.geometry,
        [draft],
    )

    /** Éléments avec leur géométrie de brouillon : ce que l'éditeur dessine. */
    const drafted = useMemo(
        () => items.map((item) => (draft[item.key] ? { ...item, geometry: draft[item.key] } : item)),
        [items, draft],
    )

    /** Nouveau rectangle, ou `null` pour renvoyer l'élément dans la palette. */
    const setRect = useCallback((item: PlanItem, rect: Rect | null) => {
        setDraft((prev) => {
            const rotation = (prev[item.key] ?? item.geometry).rotation
            return { ...prev, [item.key]: geometryOf(rect, rotation) }
        })
    }, [])

    /** Pose un élément non placé : au centre de son parent s'il est placé. */
    const place = useCallback(
        (item: PlanItem) => {
            const parent = item.parentKey ? drafted.find((i) => i.key === item.parentKey) : undefined
            const rect = initialRect(item.kind, bounds, parent ? rectOf(parent.geometry) : null)
            setDraft((prev) => ({ ...prev, [item.key]: geometryOf(rect, 0) }))
        },
        [drafted, bounds],
    )

    const rotate = useCallback(
        (item: PlanItem, delta: number) => {
            const current = geometryFor(item)
            const rect = rectOf(current)
            if (!rect) return
            setDraft((prev) => ({
                ...prev,
                [item.key]: geometryOf(rect, normalizeRotation(current.rotation + delta)),
            }))
        },
        [geometryFor],
    )

    /** Angle absolu, en degrés (poignée de rotation, saisie au degré). */
    const setRotation = useCallback(
        (item: PlanItem, degrees: number) => {
            const rect = rectOf(geometryFor(item))
            if (!rect) return
            setDraft((prev) => ({ ...prev, [item.key]: geometryOf(rect, normalizeRotation(degrees)) }))
        },
        [geometryFor],
    )

    const changes = useMemo<GeometryChange[]>(
        () =>
            items.flatMap((item) => {
                const next = draft[item.key]
                if (!next || sameGeometry(next, item.geometry)) return []
                return [{ type: item.type, id: item.id, geometry: next }]
            }),
        [items, draft],
    )

    const reset = useCallback(() => setDraft({}), [])

    /** Oublie le brouillon d'un élément (sa forme vient d'être enregistrée). */
    const discard = useCallback((key: string) => {
        setDraft((prev) => {
            if (!(key in prev)) return prev
            const next = { ...prev }
            delete next[key]
            return next
        })
    }, [])

    return { drafted, geometryFor, setRect, place, rotate, setRotation, changes, reset, discard }
}
