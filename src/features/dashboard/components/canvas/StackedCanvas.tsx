import type { WidgetSettingValue } from "@/shared/types/widget.types"
import { stackOrder } from "../../layout/gridEngine"
import type { LayoutItem } from "../../types/layout.types"
import { getWidget } from "../../widgets/registry"
import { WidgetCard } from "./WidgetCard"

interface Props {
    items: LayoutItem[]
    compact: boolean
    colWidth: number
    onRemove: (instanceId: string) => void
    onDuplicate: (instanceId: string) => void
    onOpenSettings: (instanceId: string) => void
    onSettingsChange: (
        instanceId: string,
        patch: Record<string, WidgetSettingValue>
    ) => void
}

/**
 * Aucun geste n'est possible ici : une seule fonction vide suffit, et son
 * identité stable évite de casser la mémoïsation des cartes.
 */
function noop() {}

/**
 * Les modules empilés, sous le point de rupture d'édition.
 *
 * Une colonne unique, dans l'ordre de lecture. **Un seul agencement est
 * enregistré**, celui à douze colonnes : cet ordre est dérivé à
 * l'affichage et jamais persisté, donc rien n'est perdu en passant sur un
 * petit écran, et revenir sur un grand écran retrouve la page telle
 * qu'elle a été agencée.
 *
 * La hauteur est posée en `minHeight` et non en `height`, et calculée par
 * `canvasHeight` côté carte : sur le canevas, un module de N unités
 * occupe aussi les N-1 gouttières qu'il enjambe. Le calcul brut
 * `h * ROW_UNIT` lui rendait 240 px là où il en a 288 sur grand écran —
 * le contenu était donc rogné différemment selon l'appareil. Empilé, plus
 * rien n'est aligné sur une grille : autant laisser le contenu s'étendre
 * au-delà.
 */
export function StackedCanvas({
    items,
    compact,
    colWidth,
    onRemove,
    onDuplicate,
    onOpenSettings,
    onSettingsChange,
}: Props) {
    return (
        <div className="flex flex-col gap-4">
            {stackOrder(items).map((item) => {
                const widget = getWidget(item.widgetId)
                if (!widget) return null

                return (
                    <WidgetCard
                        key={item.instanceId}
                        item={item}
                        widget={widget}
                        stacked
                        x={item.x}
                        y={item.y}
                        w={item.w}
                        h={item.h}
                        dataHeight={item.h}
                        editing={false}
                        compact={compact}
                        colWidth={colWidth}
                        active={false}
                        onResizeStart={noop}
                        onResizeMove={noop}
                        onResizeEnd={noop}
                        onResizeStep={noop}
                        onRemove={onRemove}
                        onDuplicate={onDuplicate}
                        onOpenSettings={onOpenSettings}
                        onSettingsChange={onSettingsChange}
                    />
                )
            })}
        </div>
    )
}
