import { Printer, Tags } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { Skeleton } from "@/shared/ui/atoms/skeleton"
import { labelSummary } from "@/features/stock_handpick/utils/codeLabelSheet"
import type { CodeItem } from "@/features/stock_handpick/utils/emplacementGroups"

interface CodeLabelSheetProps {
    items: CodeItem[]
    ready: boolean
    qrAt: (i: number) => string | null | undefined
    onPrint: () => void
    onClear: () => void
}

/**
 * Panneau d'impression : combien d'étiquettes, sur combien de pages, le
 * bouton « Imprimer » et l'aperçu des étiquettes sélectionnées.
 */
export function CodeLabelSheet({ items, ready, qrAt, onPrint, onClear }: CodeLabelSheetProps) {
    if (items.length === 0) {
        return (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center">
                <Tags size={28} className="text-muted-foreground" aria-hidden />
                <p className="text-base font-medium text-foreground">Aucune étiquette sélectionnée</p>
                <p className="text-sm text-muted-foreground">
                    Touchez les cases des racks pour préparer les étiquettes à imprimer.
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div>
                <h3 className="text-lg font-semibold text-foreground">Étiquettes</h3>
                <p className="text-sm tabular-nums text-muted-foreground">{labelSummary(items.length)}</p>
            </div>
            <div className="flex flex-col gap-2">
                <Button size="lg" onClick={onPrint} disabled={!ready}>
                    <Printer size={18} aria-hidden />
                    Imprimer
                </Button>
                <Button variant="ghost" size="sm" onClick={onClear}>
                    Tout désélectionner
                </Button>
            </div>
            <ul className="grid max-h-96 grid-cols-3 gap-2 overflow-y-auto pr-1" aria-label="Aperçu des étiquettes">
                {items.map((item, i) => {
                    const qr = qrAt(i)
                    return (
                        <li key={item.id} className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-border bg-background p-2">
                            {qr === undefined ? (
                                <Skeleton className="aspect-square w-full" />
                            ) : qr ? (
                                <img src={qr} alt={`QR ${item.path}`} className="aspect-square w-full" />
                            ) : (
                                <span className="flex aspect-square w-full items-center justify-center text-xs text-destructive">
                                    QR indisponible
                                </span>
                            )}
                            <span className="w-full truncate text-center font-mono text-xs font-semibold text-foreground">
                                {item.path}
                            </span>
                        </li>
                    )
                })}
            </ul>
        </div>
    )
}
