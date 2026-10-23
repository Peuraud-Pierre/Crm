import { useCallback, useMemo, useRef, useState, type RefObject } from "react"
import {
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragMoveEvent,
    type DragStartEvent,
    type KeyboardCoordinateGetter,
    type Modifier,
    type UniqueIdentifier,
} from "@dnd-kit/core"
import { sizeBounds } from "@/shared/types/widget.types"
import { GRID_GAP, ROW_UNIT } from "../constants"
import { toGridDelta } from "../layout/geometry"
import {
    clampRect,
    place,
    resizeRect,
    type Rect,
    type ResizeEdge,
} from "../layout/gridEngine"
import type { LayoutItem } from "../types/layout.types"
import { getWidget } from "../widgets/registry"
import { rectOf } from "../widgets/resolveLayout"

/**
 * Le pilotage des gestes du canevas : déplacement et redimensionnement.
 *
 * Extrait de `WidgetCanvas` — qui mêlait ce pilotage, le rendu du canevas
 * absolu et le rendu empilé, et dépassait largement le seuil de 400
 * lignes du projet. Ces trois choses changent pour des raisons
 * différentes : la façon dont on saisit un module n'a rien à voir avec la
 * façon dont on l'empile sur un téléphone.
 *
 * Le hook ne rend rien. Il maintient l'aperçu — la disposition telle
 * qu'elle serait si on relâchait maintenant — et laisse au composant le
 * soin de l'afficher.
 */

/** Geste en cours : ce qu'on manipule, et depuis quel rectangle. */
export interface Gesture {
    instanceId: string
    kind: "drag" | "resize"
    origin: Rect
    /** Où le module atterrira si on relâche maintenant. */
    landing: Rect
}

/** Signature d'un rectangle, pour détecter qu'il n'a pas changé. */
function rectKey(rect: Rect): string {
    return `${rect.x}:${rect.y}:${rect.w}:${rect.h}`
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max)
}

interface Options {
    items: LayoutItem[]
    colWidth: number
    /** Le conteneur du canevas, pour borner le déplacement. */
    canvasRef: RefObject<HTMLDivElement | null>
    onPlace: (instanceId: string, rect: Rect) => void
}

export function useCanvasGestures({
    items,
    colWidth,
    canvasRef,
    onPlace,
}: Options) {
    const [gesture, setGesture] = useState<Gesture | null>(null)
    const [preview, setPreview] = useState<LayoutItem[] | null>(null)

    /**
     * Le module qu'on vient de lâcher : il se pose sans transition.
     *
     * Pas de minuteur pour le remettre à zéro — entre deux gestes rien ne
     * bouge, donc une valeur qui traîne n'a aucun effet visible, et le
     * geste suivant l'efface au démarrage.
     */
    const [settled, setSettled] = useState<string | null>(null)

    // Le pointeur bouge en continu, la grille par cases. Tant que le
    // rectangle visé ne change pas — le cas de la grande majorité des
    // évènements — il n'y a ni disposition à recalculer ni rendu à
    // refaire.
    const lastTargetRef = useRef<string | null>(null)

    /**
     * Retient la carte déplacée à l'intérieur du canevas.
     *
     * Sans cela, elle suit le pointeur sans limite : on la traîne au-delà
     * du bord droit, hors de l'écran, alors que le moteur la ramènera de
     * toute façon dans les douze colonnes au relâchement. Le geste montre
     * donc quelque chose qui n'arrivera pas — c'est ce qui rendait
     * l'ensemble confus.
     *
     * Vers le bas, aucune limite : le canevas s'allonge, et poser un
     * module plus bas est précisément ce que la gravité épinglée autorise.
     */
    const restrictToCanvas = useCallback<Modifier>(
        ({ transform, draggingNodeRect }) => {
            // Mesuré à chaque appel, et non mis en cache au début du
            // geste : la position du canevas peut changer sous le pointeur
            // (la page défile, une bande d'annonce se replie), et un
            // bornage calculé sur des bornes périmées laisse la carte
            // sortir de la grille — c'est exactement ce que ce
            // modificateur est là pour empêcher.
            const canvas = canvasRef.current?.getBoundingClientRect()
            if (!draggingNodeRect || !canvas) return transform

            return {
                ...transform,
                x: clamp(
                    transform.x,
                    canvas.left - draggingNodeRect.left,
                    canvas.right - draggingNodeRect.right
                ),
                y: Math.max(transform.y, canvas.top - draggingNodeRect.top),
            }
        },
        [canvasRef]
    )

    /**
     * Une flèche = une case, et non les 25 px du défaut de dnd-kit.
     *
     * Le pas par défaut est exprimé en pixels : sur une grille dont la
     * colonne fait ~90 px, il aurait fallu trois ou quatre appuis pour
     * franchir une case, et le module aurait semblé ne pas répondre une
     * fois sur trois — `toGridDelta` arrondit, donc un pas trop court se
     * traduit par un déplacement nul.
     */
    const keyboardCoordinates = useCallback<KeyboardCoordinateGetter>(
        (event, { currentCoordinates }) => {
            const stepX = colWidth + GRID_GAP
            const stepY = ROW_UNIT + GRID_GAP

            switch (event.code) {
                case "ArrowRight":
                    event.preventDefault()
                    return { ...currentCoordinates, x: currentCoordinates.x + stepX }
                case "ArrowLeft":
                    event.preventDefault()
                    return { ...currentCoordinates, x: currentCoordinates.x - stepX }
                case "ArrowDown":
                    event.preventDefault()
                    return { ...currentCoordinates, y: currentCoordinates.y + stepY }
                case "ArrowUp":
                    event.preventDefault()
                    return { ...currentCoordinates, y: currentCoordinates.y - stepY }
                default:
                    return undefined
            }
        },
        [colWidth]
    )

    const sensors = useSensors(
        // Un seuil de déplacement évite qu'un clic sur le menu d'un module
        // ne déclenche un glisser (même réglage que les kanbans de
        // `projects` et `tickets`).
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        // Sans ce capteur, la poignée s'annonçait déplaçable à un lecteur
        // d'écran (dnd-kit lui pose `role` et les instructions) et ne
        // répondait à aucune touche : la seule façon de bouger un module
        // était la souris. Le redimensionnement, lui, avait déjà son
        // pilotage aux flèches (`ResizeHandles`) — c'était incohérent.
        useSensor(KeyboardSensor, { coordinateGetter: keyboardCoordinates })
    )

    const boundsOf = useCallback((item: LayoutItem) => {
        const widget = getWidget(item.widgetId)
        return widget ? sizeBounds(widget) : null
    }, [])

    /** Calcule l'aperçu pour un rectangle visé, et retient l'atterrissage. */
    const previewAt = useCallback(
        (
            instanceId: string,
            kind: Gesture["kind"],
            origin: Rect,
            target: Rect
        ) => {
            const key = rectKey(target)
            if (key === lastTargetRef.current) return
            lastTargetRef.current = key

            const item = items.find((i) => i.instanceId === instanceId)
            const bounds = item && boundsOf(item)
            if (!bounds) return

            const next = place(items, instanceId, target, bounds)
            const landed = next.find((i) => i.instanceId === instanceId)

            setGesture({
                instanceId,
                kind,
                origin,
                // La place réelle, gravité appliquée — pas le rectangle
                // visé : un repère posé là où le pointeur pointe, alors
                // que la carte remonte ailleurs, est un repère qui ment.
                landing: landed ? rectOf(landed) : clampRect(target, bounds),
            })
            setPreview(next)
        },
        [items, boundsOf]
    )

    const endGesture = useCallback(() => {
        if (gesture) {
            onPlace(gesture.instanceId, gesture.landing)
            setSettled(gesture.instanceId)
        }
        setGesture(null)
        setPreview(null)
        lastTargetRef.current = null
    }, [gesture, onPlace])

    const cancelGesture = useCallback(() => {
        setGesture(null)
        setPreview(null)
        lastTargetRef.current = null
    }, [])

    /**
     * `beginGesture` est recréée à chaque rendu ; `startResize`, elle,
     * descend jusqu'à chaque carte mémoïsée et doit rester stable. La ref
     * fait le pont sans forcer `beginGesture` dans un `useCallback` dont
     * les dépendances seraient à maintenir.
     */
    const beginGestureRef = useRef<
        (item: LayoutItem, kind: Gesture["kind"]) => void
    >(() => {})

    /** Le geste courant, pour les annonces (voir `announcements`). */
    const gestureRef = useRef<Gesture | null>(null)
    gestureRef.current = gesture

    /** Nom lisible d'un module, à défaut son identifiant. */
    const nameOfRef = useRef<(instanceId: string) => string>(() => "Module")
    nameOfRef.current = (instanceId: string) => {
        const item = items.find((i) => i.instanceId === instanceId)
        const widget = item && getWidget(item.widgetId)
        return widget?.title ?? "Module"
    }

    function beginGesture(item: LayoutItem, kind: Gesture["kind"]) {
        const origin = rectOf(item)
        lastTargetRef.current = rectKey(origin)
        setSettled(null)
        setGesture({
            instanceId: item.instanceId,
            kind,
            origin,
            landing: origin,
        })
    }

    beginGestureRef.current = beginGesture

    function handleDragStart(event: DragStartEvent) {
        const item = items.find((i) => i.instanceId === event.active.id)
        if (item) beginGesture(item, "drag")
    }

    function handleDragMove(event: DragMoveEvent) {
        if (!gesture || gesture.kind !== "drag") return

        const { dx, dy } = toGridDelta(event.delta.x, event.delta.y, colWidth)
        previewAt(gesture.instanceId, "drag", gesture.origin, {
            ...gesture.origin,
            x: gesture.origin.x + dx,
            y: gesture.origin.y + dy,
        })
    }

    /** Redimensionnement : piloté par les poignées, pas par dnd-kit. */
    function moveResize(edge: ResizeEdge, dCols: number, dRows: number) {
        if (!gesture || gesture.kind !== "resize") return

        const item = items.find((i) => i.instanceId === gesture.instanceId)
        const bounds = item && boundsOf(item)
        if (!bounds) return

        previewAt(
            gesture.instanceId,
            "resize",
            gesture.origin,
            resizeRect(gesture.origin, edge, dCols, dRows, bounds)
        )
    }

    /** Un pas au clavier : appliqué et enregistré immédiatement. */
    const stepResize = useCallback(
        (instanceId: string, dw: number, dh: number) => {
            const item = items.find((i) => i.instanceId === instanceId)
            const bounds = item && boundsOf(item)
            if (!item || !bounds) return

            onPlace(
                instanceId,
                clampRect(
                    { ...rectOf(item), w: item.w + dw, h: item.h + dh },
                    bounds
                )
            )
        },
        [items, boundsOf, onPlace]
    )

    /** Démarrage d'un redimensionnement, depuis une poignée de carte. */
    const startResize = useCallback(
        (instanceId: string) => {
            const item = items.find((i) => i.instanceId === instanceId)
            if (item) beginGestureRef.current(item, "resize")
        },
        [items]
    )

    /**
     * Ce que dit un lecteur d'écran pendant un déplacement.
     *
     * Sans cela, dnd-kit applique ses messages par défaut : en anglais au
     * milieu d'une interface française, et surtout construits sur
     * `active.id` — l'identifiant d'instance, un UUID, qui n'apprend rien
     * à personne. On nomme donc le module et **sa case**, parce que la
     * coordonnée est précisément l'information qu'on ne peut pas voir.
     *
     * Les valeurs sont lues dans des refs plutôt que dans l'état : ces
     * fonctions sont appelées par dnd-kit au moment de l'annonce, et
     * doivent voir le geste tel qu'il est à cet instant.
     */
    const announcements = useMemo(
        () => ({
            onDragStart: ({ active }: { active: { id: UniqueIdentifier } }) =>
                `${nameOfRef.current(String(active.id))} saisi. Utilisez les flèches pour le déplacer, Espace pour le poser, Échap pour annuler.`,
            onDragOver: () => undefined,
            onDragEnd: ({ active }: { active: { id: UniqueIdentifier } }) => {
                const landing = gestureRef.current?.landing
                const name = nameOfRef.current(String(active.id))
                return landing
                    ? `${name} posé colonne ${landing.x + 1}, ligne ${landing.y + 1}, sur ${landing.w} colonnes et ${landing.h} lignes.`
                    : `${name} posé.`
            },
            onDragCancel: ({ active }: { active: { id: UniqueIdentifier } }) =>
                `Déplacement de ${nameOfRef.current(String(active.id))} annulé.`,
        }),
        []
    )

    const screenReaderInstructions = useMemo(
        () => ({
            draggable:
                "Appuyez sur Espace pour saisir ce module, puis utilisez les flèches pour le déplacer d'une case. Espace pour le poser, Échap pour annuler.",
        }),
        []
    )

    return {
        gesture,
        settled,
        /** La disposition à afficher : l'aperçu s'il y en a un. */
        rendered: preview ?? items,
        sensors,
        restrictToCanvas,
        accessibility: { announcements, screenReaderInstructions },
        handleDragStart,
        handleDragMove,
        endGesture,
        cancelGesture,
        moveResize,
        startResize,
        stepResize,
    }
}
