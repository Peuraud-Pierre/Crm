import { useCallback, useState, type KeyboardEvent } from "react"
import { Loader2, RotateCcw, Save, Undo2, X } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { DEFAULT_FLOOR, type FloorLayout } from "@/features/stock_handpick/utils/floorPlan"
import {
    FIXED_KINDS,
    elementExists,
    moveElement,
    removeElement,
    rotateBy,
    rotateElement,
    type ElementRef,
} from "@/features/stock_handpick/utils/floorPlanEdit"
import { addElement } from "@/features/stock_handpick/utils/floorPlanTemplates"
import type { PlanIndex } from "@/features/stock_handpick/utils/planLayout"
import type { BalleHandpick } from "@/features/stock_handpick/types/balle.types"
import { PlanFloor } from "./PlanFloor"
import { PlanEditOverlay } from "./PlanEditOverlay"
import { PlanAddMenu, PlanEditPanel } from "./PlanEditPanel"

/** Profondeur de l'historique « Annuler ». */
const HISTORY_LIMIT = 50

interface PlanEditorProps {
    /** Disposition de départ : celle actuellement enregistrée. */
    initial: FloorLayout
    saving: boolean
    onSave: (floor: FloorLayout) => void
    onCancel: () => void
    index: PlanIndex
    ballesIn: (ids: readonly (string | undefined)[]) => BalleHandpick[]
}

/**
 * Éditeur du plan : tout élément peut être ajouté, déplacé, redimensionné,
 * pivoté ou retiré. Les modifications restent un BROUILLON jusqu'à
 * « Enregistrer » ; « Quitter » les abandonne.
 *
 * Deux façons de modifier la disposition :
 *  • `commit` — modification complète (ajout, retrait, saisie) : l'état
 *    précédent entre dans l'historique ;
 *  • `preview` — pas intermédiaire d'un glisser : l'historique a déjà reçu
 *    l'état d'avant le geste (`onGestureStart`).
 */
export function PlanEditor({ initial, saving, onSave, onCancel, index, ballesIn }: PlanEditorProps) {
    const [draft, setDraft] = useState<FloorLayout>(initial)
    const [past, setPast] = useState<FloorLayout[]>([])
    const [selected, setSelected] = useState<ElementRef | null>(null)

    const remember = useCallback((state: FloorLayout) => {
        setPast((stack) => [...stack.slice(-(HISTORY_LIMIT - 1)), state])
    }, [])

    const commit = (next: FloorLayout) => {
        if (next === draft) return
        remember(draft)
        setDraft(next)
        if (selected && !elementExists(next, selected)) setSelected(null)
    }

    const undo = () => {
        const previous = past[past.length - 1]
        if (!previous) return
        setPast(past.slice(0, -1))
        setDraft(previous)
        if (selected && !elementExists(previous, selected)) setSelected(null)
    }

    const add = (templateId: string) => {
        // Au centre de la boutique : la zone la plus dégagée du plan.
        const zone = draft.zones.D
        const result = addElement(draft, templateId, { x: zone.x + zone.w / 2, z: zone.z + zone.d / 2 })
        if (!result) return
        commit(result.floor)
        setSelected(result.ref)
    }

    const remove = () => {
        if (!selected || FIXED_KINDS.has(selected.kind)) return
        commit(removeElement(draft, selected))
        setSelected(null)
    }

    const rotate = () => {
        if (selected) commit(rotateElement(draft, selected))
    }

    const turnBy = (degrees: number) => {
        if (selected) commit(rotateBy(draft, selected, degrees))
    }

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        // Les champs de saisie gardent leurs touches.
        const target = event.target as HTMLElement
        if (target.closest("input, textarea, [role=combobox], [role=listbox]")) return

        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
            event.preventDefault()
            undo()
            return
        }
        if (!selected) return
        const step = event.shiftKey ? 1 : 0.1
        const moves: Record<string, [number, number]> = {
            ArrowLeft: [-step, 0],
            ArrowRight: [step, 0],
            ArrowUp: [0, -step],
            ArrowDown: [0, step],
        }
        if (moves[event.key]) {
            event.preventDefault()
            commit(moveElement(draft, selected, ...moves[event.key]))
        } else if (event.key === "Delete" || event.key === "Backspace") {
            event.preventDefault()
            remove()
        } else if (event.key === "[" || event.key === "]") {
            event.preventDefault()
            turnBy(event.key === "]" ? 15 : -15)
        } else if (event.key.toLowerCase() === "r") {
            event.preventDefault()
            rotate()
        } else if (event.key === "Escape") {
            setSelected(null)
        }
    }

    return (
        <div
            className="space-y-3 outline-none"
            // Conteneur focusable : les raccourcis clavier s'y appliquent.
            tabIndex={-1}
            onKeyDown={onKeyDown}
            role="region"
            aria-label="Éditeur du plan"
        >
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-2">
                <PlanAddMenu onAdd={add} />
                <Button variant="outline" size="sm" className="gap-1.5" onClick={undo} disabled={past.length === 0}>
                    <Undo2 size={13} aria-hidden />
                    Annuler
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => {
                        commit(DEFAULT_FLOOR)
                        setSelected(null)
                    }}
                >
                    <RotateCcw size={13} aria-hidden />
                    Plan d'origine
                </Button>
                <div className="ml-auto flex gap-2">
                    <Button variant="ghost" size="sm" className="gap-1.5" onClick={onCancel} disabled={saving}>
                        <X size={13} aria-hidden />
                        Quitter
                    </Button>
                    <Button size="sm" className="gap-1.5" onClick={() => onSave(draft)} disabled={saving}>
                        {saving ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <Save size={13} aria-hidden />}
                        Enregistrer
                    </Button>
                </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
                <div className="lg:col-span-2">
                    <PlanFloor
                        floor={draft}
                        index={index}
                        ballesIn={ballesIn}
                        selection={null}
                        onSelect={() => {}}
                        interactive={false}
                        overlay={
                            <PlanEditOverlay
                                floor={draft}
                                selected={selected}
                                onSelect={setSelected}
                                onPreview={setDraft}
                                onGestureStart={() => remember(draft)}
                            />
                        }
                    />
                </div>
                <div className="rounded-2xl border border-border bg-card p-4">
                    <PlanEditPanel
                        floor={draft}
                        selected={selected}
                        onChange={commit}
                        onRotate={rotate}
                        onRotateBy={turnBy}
                        onRemove={remove}
                    />
                </div>
            </div>
        </div>
    )
}
