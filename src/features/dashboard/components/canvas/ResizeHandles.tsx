import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react"
import { cn } from "@/shared/lib/utils"
import { GRID_GAP, ROW_UNIT } from "../../constants"
import type { ResizeEdge } from "../../layout/gridEngine"

interface Props {
    label: string
    colWidth: number
    onStart: (edge: ResizeEdge) => void
    /** Déplacement depuis le début du geste, en cases. */
    onMove: (edge: ResizeEdge, dCols: number, dRows: number) => void
    onEnd: () => void
    /** Ajustement d'une case au clavier. */
    onStep: (dw: number, dh: number) => void
}

/**
 * Position et curseur de chaque poignée.
 *
 * Les bords s'arrêtent à trois unités des coins : sans cet écart, un coin
 * est presque impossible à viser, et on redimensionne selon un seul axe
 * en croyant en tenir deux.
 */
const PLACEMENT: Record<ResizeEdge, string> = {
    n: "-top-1 right-3 left-3 h-2 cursor-ns-resize",
    s: "-bottom-1 right-3 left-3 h-2 cursor-ns-resize",
    w: "top-3 bottom-3 -left-1 w-2 cursor-ew-resize",
    e: "top-3 bottom-3 -right-1 w-2 cursor-ew-resize",
    nw: "-top-1 -left-1 size-3 cursor-nwse-resize",
    ne: "-top-1 -right-1 size-3 cursor-nesw-resize",
    sw: "-bottom-1 -left-1 size-3 cursor-nesw-resize",
    se: "-right-1 -bottom-1 size-5 cursor-nwse-resize",
}

const EDGES: ResizeEdge[] = ["n", "s", "w", "e", "nw", "ne", "sw", "se"]

const EDGE_LABELS: Record<ResizeEdge, string> = {
    n: "par le haut",
    s: "par le bas",
    w: "par la gauche",
    e: "par la droite",
    nw: "par le coin haut gauche",
    ne: "par le coin haut droit",
    sw: "par le coin bas gauche",
    se: "par le coin bas droit",
}

/**
 * Les huit poignées de redimensionnement d'un module.
 *
 * Elles n'existent qu'en mode édition. Le geste est piloté par capture de
 * pointeur plutôt que par dnd-kit : dnd-kit résout des déplacements entre
 * zones de dépôt, ce qui n'est pas ce dont on a besoin ici — il n'y a
 * qu'un delta à convertir.
 *
 * **Une seule poignée est focalisable**, celle du coin bas-droit, et elle
 * porte le pilotage aux flèches. Huit arrêts de tabulation par module
 * rendraient la page inutilisable au clavier : ce serait payer une
 * amélioration de la souris par une régression de l'accessibilité. La
 * taille reste par ailleurs réglable au chiffre près dans le panneau de
 * réglages du module.
 */
export function ResizeHandles({
    label,
    colWidth,
    onStart,
    onMove,
    onEnd,
    onStep,
}: Props) {
    return (
        <>
            {EDGES.map((edge) => (
                <ResizeHandle
                    key={edge}
                    edge={edge}
                    label={label}
                    colWidth={colWidth}
                    onStart={onStart}
                    onMove={onMove}
                    onEnd={onEnd}
                    onStep={onStep}
                />
            ))}
        </>
    )
}

function ResizeHandle({
    edge,
    label,
    colWidth,
    onStart,
    onMove,
    onEnd,
    onStep,
}: Props & { edge: ResizeEdge }) {
    const originRef = useRef<{ x: number; y: number } | null>(null)
    const latestRef = useRef<{ x: number; y: number } | null>(null)
    const frameRef = useRef<number | null>(null)

    // Un `pointermove` peut être émis plus souvent qu'une frame n'est
    // peinte. Sans ce sas, chaque évènement déclenche un recalcul complet
    // de la disposition pour un résultat qui ne sera jamais affiché.
    useEffect(
        () => () => {
            if (frameRef.current !== null)
                cancelAnimationFrame(frameRef.current)
        },
        []
    )

    function flush() {
        frameRef.current = null

        const origin = originRef.current
        const latest = latestRef.current
        if (!origin || !latest) return

        onMove(
            edge,
            Math.round((latest.x - origin.x) / (colWidth + GRID_GAP)),
            Math.round((latest.y - origin.y) / (ROW_UNIT + GRID_GAP))
        )
    }

    function handlePointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
        event.preventDefault()
        event.stopPropagation()

        originRef.current = { x: event.clientX, y: event.clientY }
        latestRef.current = null
        event.currentTarget.setPointerCapture(event.pointerId)
        onStart(edge)
    }

    function handlePointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
        if (!originRef.current) return

        latestRef.current = { x: event.clientX, y: event.clientY }
        if (frameRef.current === null)
            frameRef.current = requestAnimationFrame(flush)
    }

    function handlePointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
        if (!originRef.current) return

        if (frameRef.current !== null) {
            cancelAnimationFrame(frameRef.current)
            frameRef.current = null
        }

        originRef.current = null
        latestRef.current = null
        event.currentTarget.releasePointerCapture(event.pointerId)
        onEnd()
    }

    function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
        const step: Record<string, [number, number]> = {
            ArrowRight: [1, 0],
            ArrowLeft: [-1, 0],
            ArrowDown: [0, 1],
            ArrowUp: [0, -1],
        }
        const delta = step[event.key]
        if (!delta) return

        event.preventDefault()
        onStep(delta[0], delta[1])
    }

    const keyboard = edge === "se"

    return (
        <button
            type="button"
            tabIndex={keyboard ? undefined : -1}
            aria-hidden={keyboard ? undefined : "true"}
            aria-label={
                keyboard ? `Redimensionner ${label}` : `Redimensionner ${label} ${EDGE_LABELS[edge]}`
            }
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onKeyDown={keyboard ? handleKeyDown : undefined}
            className={cn(
                "absolute z-10 touch-none rounded-full bg-primary/0 transition-colors duration-fast hover:bg-primary/40 focus-visible:bg-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                PLACEMENT[edge],
                // Au repos, seul le coin bas-droit se voit. Huit poignées
                // dessinées en permanence transformeraient chaque module
                // en cadre de retouche photo.
                keyboard &&
                    "bg-transparent text-muted-foreground/60 hover:bg-transparent hover:text-foreground"
            )}
        >
            {keyboard && (
                /* Deux traits obliques : la convention de coin étirable,
                   sans le poids visuel d'une pastille pleine. */
                <svg viewBox="0 0 12 12" className="size-full" aria-hidden="true">
                    <path
                        d="M11 4 4 11M11 8 8 11"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        fill="none"
                    />
                </svg>
            )}
        </button>
    )
}
