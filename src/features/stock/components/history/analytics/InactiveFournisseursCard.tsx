import { Link } from "react-router"
import { CheckCircle2, MoveRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/atoms/card"
import { Skeleton } from "@/shared/ui/atoms/skeleton"
import { Button } from "@/shared/ui/atoms/button"
import { FOURNISSEUR_INACTIVE_DAYS } from "@/features/stock/constants"
import type { FournisseurStats } from "@/features/stock/utils/fournisseurAnalytics"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import { STOCK_ROUTE_BASE } from "@/features/stock/types/ui.types"

const MAX_LISTED = 6

const SKELETON_ROWS = ["ik1", "ik2", "ik3"]

interface InactiveFournisseursCardProps {
    inactive: FournisseurStats[]
    loading?: boolean
}

function formatLastSeen(value: string | null): string {
    if (!value) return "Jamais"
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return "Date inconnue"
    return parsed.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
}

/** Fournisseurs dormants : candidats au nettoyage du référentiel. */
export function InactiveFournisseursCard({ inactive, loading = false }: InactiveFournisseursCardProps) {
    return (
        <Card className="min-w-0">
            <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
                <div className="min-w-0">
                    <CardTitle className="text-base">Fournisseurs dormants</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Sans arrivage depuis plus de {FOURNISSEUR_INACTIVE_DAYS} jours.
                    </p>
                </div>
                <Button asChild variant="ghost" size="sm" className="shrink-0 gap-1.5 text-xs">
                    <Link to={`${STOCK_ROUTE_BASE}/parametres/fournisseurs`}>
                        <span className="hidden sm:inline">Gérer</span>
                        <MoveRight size={14} />
                    </Link>
                </Button>
            </CardHeader>
            <CardContent aria-busy={loading}>
                {loading ? (
                    <div className="flex flex-col gap-2">
                        {SKELETON_ROWS.map((key) => (
                            <Skeleton key={key} aria-hidden className="h-10 w-full rounded-lg" />
                        ))}
                    </div>
                ) : inactive.length === 0 ? (
                    <EmptyState
                        icon={CheckCircle2}
                        title="Référentiel à jour"
                        description="Tous les fournisseurs ont eu un arrivage récent."
                    />
                ) : (
                    <ul className="flex flex-col divide-y divide-border">
                        {inactive.slice(0, MAX_LISTED).map((entry) => (
                            <li
                                key={entry.fournisseur_id}
                                className="flex items-center justify-between gap-3 py-2.5 text-sm"
                            >
                                <span className="truncate font-medium text-foreground">{entry.name}</span>
                                <span className="shrink-0 text-muted-foreground tabular-nums">
                                    {formatLastSeen(entry.lastArrivageAt)}
                                </span>
                            </li>
                        ))}
                        {inactive.length > MAX_LISTED && (
                            <li className="pt-2.5 text-xs text-muted-foreground">
                                et {inactive.length - MAX_LISTED} autre
                                {inactive.length - MAX_LISTED > 1 ? "s" : ""}…
                            </li>
                        )}
                    </ul>
                )}
            </CardContent>
        </Card>
    )
}
