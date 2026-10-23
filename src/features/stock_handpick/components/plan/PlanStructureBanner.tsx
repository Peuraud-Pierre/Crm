import { AlertTriangle, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"

interface PlanStructureBannerProps {
    missing: string[]
    syncing: boolean
    failed: boolean
    allowed: boolean
    onRetry: () => void
}

/**
 * État de la liaison plan ↔ emplacements : création en cours, échec, ou
 * emplacements manquants que l'utilisateur ne peut pas créer lui-même.
 * Rien n'est affiché quand tout est relié.
 */
export function PlanStructureBanner({ missing, syncing, failed, allowed, onRetry }: PlanStructureBannerProps) {
    if (syncing) {
        return (
            <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
                <Loader2 size={14} className="animate-spin text-primary" aria-hidden />
                Création des emplacements du plan…
            </div>
        )
    }
    if (missing.length === 0) return null

    return (
        <div role="alert" className="flex flex-wrap items-center gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
            <AlertTriangle size={14} className="shrink-0 text-warning" aria-hidden />
            <span className="min-w-0 flex-1">
                <span className="font-semibold">Emplacements absents de la base : </span>
                {missing.join(", ")}.{" "}
                {allowed
                    ? "Les balles ne peuvent pas y être rangées tant qu'ils ne sont pas créés."
                    : "Il faut le droit « stock_handpick.plan.create » (et « plan.update ») pour les créer, ou exécuter les migrations du plan."}
            </span>
            {allowed && failed && (
                <Button size="sm" variant="outline" className="h-7 gap-1.5" onClick={onRetry}>
                    <RefreshCw size={12} aria-hidden />
                    Réessayer
                </Button>
            )}
        </div>
    )
}
