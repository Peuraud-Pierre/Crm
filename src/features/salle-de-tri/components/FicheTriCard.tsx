import { memo } from "react"
import { AlertTriangle, ClipboardList, Clock, Package, Shirt } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/shared/ui/atoms/card"
import { cn } from "@/shared/lib/utils"
import {
    ecarts,
    formatDuree,
    formatEcart,
    fournisseursDe,
    poidsInitial,
    qualitePonderee,
} from "@/features/salle-de-tri/utils/triAnalytics"
import type { FicheTriComplete } from "@/features/salle-de-tri/types/tri.types"
import { QualiteStars } from "./QualiteStars"
import { RepartitionBar } from "./RepartitionBar"

interface FicheTriCardProps {
    fiche: FicheTriComplete
    onOpen: (fiche: FicheTriComplete) => void
}

/**
 * Carte d'une fiche de tri, dans la lecture des cartes de balles du stock :
 * le n° en en-tête, le poids trié en gros chiffres, le trieur en badge, puis
 * où sont partis les kilos et ce qu'il faut savoir (balles, qualité, temps,
 * fournisseurs). La pastille d'en-tête dit s'il y a un écart à vérifier.
 *
 * Chiffres lus sur les balles (filtrées) : filtrer sur une catégorie ou un
 * fournisseur change ce que montre la carte, comme la ligne du tableau.
 */
export const FicheTriCard = memo(function FicheTriCard({ fiche, onOpen }: FicheTriCardProps) {
    const kg = poidsInitial(fiche.balles)
    const ecart = ecarts(fiche.balles)
    const nb = fiche.balles.length

    return (
        <Card
            variant="interactive"
            role="button"
            tabIndex={0}
            aria-label={`Fiche ${fiche.code}, ${fiche.trieur_nom}${ecart.balles ? `, ${ecart.balles} balle${ecart.balles > 1 ? "s" : ""} en écart` : ""}`}
            onClick={() => onOpen(fiche)}
            onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    onOpen(fiche)
                }
            }}
            className={cn(
                "group relative flex min-h-52 select-none flex-col overflow-hidden border bg-card p-0",
                "active:scale-98 motion-reduce:active:scale-100",
                ecart.balles ? "border-warning/40 hover:border-warning/70" : "border-border hover:border-primary/40",
            )}
        >
            {/* Même clin d'œil que les balles du stock : un vêtement tombe au survol. */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
                <Shirt
                    size={40}
                    className="absolute -top-12 left-1/2 -translate-x-1/2 rotate-12 text-primary opacity-0 transition-[top,opacity] duration-slower ease-in-out group-hover:top-1/4 group-hover:opacity-10"
                />
            </div>

            <CardHeader className="z-10 flex flex-row items-center justify-between space-y-0 border-b border-border/60 p-2.5">
                <span className="flex items-center gap-1.5 overflow-hidden">
                    <ClipboardList size={12} className="shrink-0 opacity-50" aria-hidden />
                    <span className="truncate font-mono text-xs font-bold tracking-tight">{fiche.code}</span>
                </span>
                {ecart.balles > 0 ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-warning" title="Balles en écart">
                        <AlertTriangle size={12} aria-hidden />
                        {formatEcart(ecart.kg)}
                    </span>
                ) : (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-success" title="Tout est réparti" aria-hidden />
                )}
            </CardHeader>

            <CardContent className="z-10 flex flex-1 flex-col items-center justify-center gap-2 p-3">
                <span className="flex items-baseline gap-0.5 transition-transform duration-slow group-hover:scale-110">
                    <span className="text-3xl font-black tabular-nums tracking-tighter">{Math.round(kg * 10) / 10}</span>
                    <span className="text-xs font-bold opacity-40">kg</span>
                </span>
                <span className="line-clamp-1 rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                    {fiche.trieur_nom}
                </span>
                <div className="w-full px-1">
                    <RepartitionBar balles={fiche.balles} compact />
                </div>
                <span className="line-clamp-1 text-center text-xs text-muted-foreground" title={fournisseursDe(fiche)}>
                    {fournisseursDe(fiche)}
                </span>
            </CardContent>

            <div className="z-10 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-t border-border/60 px-2.5 py-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1 tabular-nums">
                    <Package size={11} aria-hidden />
                    {nb} balle{nb > 1 ? "s" : ""}
                </span>
                <QualiteStars value={qualitePonderee(fiche.balles)} size="sm" />
                <span className="inline-flex items-center gap-1 tabular-nums">
                    <Clock size={11} aria-hidden />
                    {fiche.duree_minutes ? formatDuree(fiche.duree_minutes) : "—"}
                </span>
            </div>

        </Card>
    )
})
