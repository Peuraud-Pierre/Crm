import { AlertTriangle, CheckCircle2 } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { TRI_ECART_SEUIL_KG } from "@/features/salle-de-tri/constants"
import { formatEcart, formatKg } from "@/features/salle-de-tri/utils/triAnalytics"
import { useSortieColor } from "./RepartitionBar"

interface RepartitionGaugeProps {
    /** Kilos par type de sortie, dans l'ordre d'affichage. */
    parts: readonly { sortieId: string; kg: number }[]
    /** Poids initial de la balle ; `null` tant qu'il n'est pas lisible. */
    initial: number | null
    className?: string
}

/**
 * Jauge d'une balle : la répartition se REMPLIT jusqu'au poids initial.
 *
 *   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░   il manque des kilos : le reste est hachuré
 *   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│▓▓ trop de kilos : un trait marque le poids initial
 *
 * L'échelle est le plus grand des deux poids, pour que le dépassement reste
 * visible. Un écart est signalé, jamais bloquant.
 */
export function RepartitionGauge({ parts, initial, className }: RepartitionGaugeProps) {
    const color = useSortieColor()
    const reparti = parts.reduce((s, p) => s + p.kg, 0)
    const scale = Math.max(initial ?? 0, reparti)
    const pct = (kg: number) => (scale > 0 ? (kg / scale) * 100 : 0)
    const ecart = initial === null ? null : Math.round((reparti - initial) * 100) / 100
    const enEcart = ecart !== null && Math.abs(ecart) >= TRI_ECART_SEUIL_KG

    return (
        <div className={cn("flex flex-col gap-1.5", className)}>
            <div
                className="relative flex h-2.5 w-full overflow-hidden rounded-full bg-muted"
                role="img"
                aria-label={initial === null
                    ? `${formatKg(reparti)} répartis`
                    : `${formatKg(reparti)} répartis sur ${formatKg(initial)}`}
            >
                {parts.filter((p) => p.kg > 0).map((p) => (
                    // Largeur = donnée : posée en style inline, pas en classe.
                    <div key={p.sortieId} className="h-full" style={{ width: `${pct(p.kg)}%`, backgroundColor: color(p.sortieId) }} />
                ))}
                {ecart !== null && ecart < 0 && (
                    <div
                        className="h-full"
                        style={{
                            width: `${pct(-ecart)}%`,
                            backgroundImage: "repeating-linear-gradient(135deg, var(--color-warning) 0 2px, transparent 2px 6px)",
                            opacity: 0.55,
                        }}
                        aria-hidden
                    />
                )}
                {ecart !== null && ecart > 0 && (
                    <div
                        className="absolute inset-y-0 w-0.5 bg-foreground"
                        style={{ left: `${pct(initial ?? 0)}%` }}
                        aria-hidden
                    />
                )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
                <span className="tabular-nums text-muted-foreground">
                    <span className="font-semibold text-foreground">{formatKg(reparti)}</span>
                    {initial !== null && <> répartis sur {formatKg(initial)}</>}
                    {initial === null && " répartis"}
                </span>
                {ecart !== null && (enEcart ? (
                    <span className="inline-flex items-center gap-1 font-medium text-warning">
                        <AlertTriangle size={12} aria-hidden />
                        {ecart < 0 ? `Il manque ${formatKg(-ecart)}` : `${formatKg(ecart)} de trop`}
                        <span className="sr-only">(écart {formatEcart(ecart)})</span>
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-1 font-medium text-success">
                        <CheckCircle2 size={12} aria-hidden />
                        Tout est réparti
                    </span>
                ))}
            </div>
        </div>
    )
}
