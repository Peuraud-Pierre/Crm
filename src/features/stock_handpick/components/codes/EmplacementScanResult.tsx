import { MapPin, ScanLine, X } from "lucide-react"
import { Badge } from "@/shared/ui/atoms/badge"
import { Button } from "@/shared/ui/atoms/button"
import { cn } from "@/shared/lib/utils"
import { HANDPICK_THEME } from "@/features/stock_handpick/theme"
import type { BalleHandpick } from "@/features/stock_handpick/types/balle.types"
import type { Emplacement } from "@/features/stock_handpick/types/location.types"
import { BalleChip } from "@/features/stock_handpick/components/plan/BalleChip"

interface EmplacementScanResultProps {
    /** Emplacement résolu, ou `undefined` si l'id ne correspond à rien. */
    emplacement: Emplacement | undefined
    path: string | null
    balles: BalleHandpick[]
    onClose: () => void
    onOpenBalle: (id: string) => void
    onShowInPlan: (id: string) => void
}

/** Résultat du scan d'une étiquette : l'emplacement et ce qu'il contient. */
export function EmplacementScanResult({
    emplacement,
    path,
    balles,
    onClose,
    onOpenBalle,
    onShowInPlan,
}: EmplacementScanResultProps) {
    const title = emplacement ? path ?? emplacement.code : "Code non reconnu"

    const retired = emplacement && !emplacement.is_active

    return (
        <section
            aria-label="Résultat du scan"
            className={cn(
                "space-y-4 rounded-2xl border-2 p-5 shadow-sm animate-in fade-in-0 slide-in-from-bottom-1 duration-base",
                emplacement ? "border-primary/40 bg-primary/5" : "border-destructive/40 bg-destructive/5",
            )}
        >
            <div className="flex items-start gap-3">
                <span
                    aria-hidden
                    className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                        emplacement ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive",
                    )}
                >
                    <ScanLine size={20} />
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Étiquette scannée
                    </p>
                    <h3 className="break-words font-mono text-xl font-bold text-foreground">{title}</h3>
                    {emplacement && (
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                            <span className="tabular-nums">
                                {balles.length} balle{balles.length > 1 ? "s" : ""}
                            </span>
                            {retired && <Badge variant="secondary">Emplacement retiré</Badge>}
                        </div>
                    )}
                </div>
                <Button variant="ghost" size="icon" className="shrink-0" onClick={onClose} aria-label="Fermer le résultat">
                    <X size={16} />
                </Button>
            </div>

            {!emplacement ? (
                <p className="text-sm text-muted-foreground">
                    Cette étiquette ne correspond à aucun emplacement du stock handpick.
                </p>
            ) : (
                <>
                    {balles.length === 0 ? (
                        <p className={cn("text-sm", HANDPICK_THEME.card.emptyValue)}>Aucune balle à cet emplacement.</p>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {balles.map((balle) => (
                                <BalleChip key={balle.id} balle={balle} onOpen={onOpenBalle} />
                            ))}
                        </div>
                    )}
                    <Button variant="outline" onClick={() => onShowInPlan(emplacement.id)}>
                        <MapPin size={16} aria-hidden />
                        Voir dans le plan
                    </Button>
                </>
            )}
        </section>
    )
}
