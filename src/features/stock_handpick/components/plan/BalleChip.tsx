import { cn } from "@/shared/lib/utils"
import { HANDPICK_THEME } from "@/features/stock_handpick/theme"
import { QUANTITY_UNIT_LABELS, UUID_DISPLAY_LENGTH } from "@/features/stock_handpick/constants"
import type { BalleHandpick } from "@/features/stock_handpick/types/balle.types"

const numberFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 })

/** Puce d'une balle rangée : cliquer ouvre sa fiche. Partagée par le plan et l'onglet Codes. */
export function BalleChip({ balle, onOpen }: { balle: BalleHandpick; onOpen: (id: string) => void }) {
    const unit =
        balle.packing_mode === "pieces" ? QUANTITY_UNIT_LABELS.pieces : QUANTITY_UNIT_LABELS.kg
    return (
        <button
            type="button"
            onClick={() => onOpen(balle.id)}
            className="flex max-w-full items-center gap-1.5 rounded-lg border border-border bg-background px-2 py-1 text-left text-xs transition-colors duration-base hover:border-primary hover:bg-primary/5"
        >
            <span className={cn("shrink-0", HANDPICK_THEME.card.identity)}>
                {balle.id.slice(0, UUID_DISPLAY_LENGTH)}
            </span>
            <span className="truncate font-medium text-foreground">
                {balle.raw_name ?? balle.category?.name ?? "Sans libellé"}
            </span>
            {balle.packing !== null && (
                <span className="shrink-0 tabular-nums text-muted-foreground">
                    {numberFormatter.format(balle.packing)} {unit}
                </span>
            )}
        </button>
    )
}
