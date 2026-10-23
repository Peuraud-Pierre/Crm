import { Plus } from "lucide-react"
import { Badge } from "@/shared/ui/atoms/badge"
import { Button } from "@/shared/ui/atoms/button"
import { PLAN_KIND_LABEL } from "@/features/magasins/constants"
import type { PlanItem } from "@/features/magasins/types/magasin.types"

interface UnplacedPaletteProps {
    items: readonly PlanItem[]
    onPlace: (item: PlanItem) => void
}

/** Éléments créés mais pas encore posés sur le plan, à placer d'un clic. */
export function UnplacedPalette({ items, onPlace }: UnplacedPaletteProps) {
    if (items.length === 0) return null
    return (
        <div className="flex flex-col gap-2 rounded-xl border border-dashed border-border bg-muted/20 p-3">
            <p className="text-xs font-medium text-muted-foreground">
                À placer ({items.length}) — un élément se pose au centre de sa zone, ou du magasin
            </p>
            <div className="flex flex-wrap gap-2">
                {items.map((item) => (
                    <Button key={item.key} variant="outline" size="sm" onClick={() => onPlace(item)}>
                        <Plus size={14} />
                        <span className="font-semibold">{item.path}</span>
                        <Badge variant="secondary">{PLAN_KIND_LABEL[item.kind]}</Badge>
                    </Button>
                ))}
            </div>
        </div>
    )
}
