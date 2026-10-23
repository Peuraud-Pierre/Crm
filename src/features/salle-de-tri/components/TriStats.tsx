import { useMemo, useState } from "react"
import { AlertTriangle, BarChart3, Info, Percent, Scale } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/atoms/card"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import { VueToggle } from "@/shared/ui/molecules/vue-toggle"
import { SkeletonStatTiles } from "@/shared/ui/molecules/skeleton-presets"
import { GESTION_THEME, useReferentialContext } from "@/features/stock"
import { TRI_ECART_SEUIL_KG } from "@/features/salle-de-tri/constants"
import { useTriContext } from "@/features/salle-de-tri/hooks/context/TriContext"
import { computeTriAnalytics, formatEcart, formatKg, type TriAnalytics } from "@/features/salle-de-tri/utils/triAnalytics"
import { QualiteStars } from "./QualiteStars"
import { KgParSemaineChart, KgParTrieurChart } from "./TriCharts"
import { useSortieColor } from "./RepartitionBar"

const fmtQualite = (q: number | null) => (q === null ? "—" : q.toLocaleString("fr-FR", { maximumFractionDigits: 2 }))
const fmtKgH = (v: number | null) => (v === null ? "—" : `${Math.round(v)} kg/h`)

/**
 * Statistiques de la salle de tri, sur EXACTEMENT les fiches filtrées du
 * tableau (même contexte) : changer un filtre change les deux vues.
 */
export function TriStats() {
    const { filtered, loading, trieurById, sorties, categoryName } = useTriContext()
    const { fournisseurs } = useReferentialContext()
    const sortieColor = useSortieColor()
    const a = useMemo(() => computeTriAnalytics(filtered), [filtered])
    const fournisseurName = useMemo(() => new Map(fournisseurs.map((f) => [f.id, f.name])), [fournisseurs])
    const [semaineMode, setSemaineMode] = useState<"kg" | "pct">("kg")

    if (loading) return <SkeletonStatTiles count={4} />
    if (a.totals.fiches === 0) {
        return (
            <EmptyState
                icon={BarChart3}
                title="Rien à analyser"
                description="Aucune fiche de tri ne correspond aux filtres sur cette période."
                className={GESTION_THEME.board.emptyState}
            />
        )
    }

    const sortiesVisibles = sorties.filter((s) => a.parSortie.some((p) => p.sortieId === s.id))

    return (
        <div className="flex flex-col gap-4">
            <RepartitionGlobale analytics={a} />

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <Card className="min-w-0">
                    <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                        <div className="flex flex-col gap-1.5">
                            <CardTitle className="text-base">Kilos répartis par semaine</CardTitle>
                            <CardDescription>
                                {semaineMode === "kg" ? "Empilés par type de sortie" : "Part de chaque type, semaine par semaine"}
                            </CardDescription>
                        </div>
                        <VueToggle vues={SEMAINE_MODES} value={semaineMode} onChange={setSemaineMode} className="w-fit shrink-0" />
                    </CardHeader>
                    <CardContent>
                        <KgParSemaineChart data={a.parSemaine} mode={semaineMode} />
                    </CardContent>
                </Card>

                <Card className="min-w-0">
                    <CardHeader>
                        <CardTitle className="text-base">Par trieur</CardTitle>
                        <CardDescription>Kilos triés ; productivité et qualité dans le tableau</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                        <KgParTrieurChart data={a.parTrieur.slice(0, 8).map((t) => ({ nom: trieurById.get(t.id)?.nom ?? "?", kg: t.kg }))} />
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-max text-sm">
                                <thead className="text-xs text-muted-foreground">
                                    <tr className="border-b border-border">
                                        <th className="py-1.5 text-left font-medium">Trieur</th>
                                        <th className="py-1.5 pl-3 text-right font-medium">Kilos</th>
                                        <th className="py-1.5 pl-3 text-right font-medium">Fiches</th>
                                        <th className="py-1.5 pl-3 text-right font-medium">kg/h</th>
                                        <th className="py-1.5 pl-3 text-right font-medium">Qualité</th>
                                        <th className="py-1.5 pl-3 text-right font-medium">Écarts</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {a.parTrieur.map((t) => (
                                        <tr key={t.id} className="border-b border-border/60 last:border-0">
                                            <td className="py-1.5 font-medium">{trieurById.get(t.id)?.nom ?? "?"}</td>
                                            <td className="py-1.5 pl-3 text-right tabular-nums">{formatKg(t.kg)}</td>
                                            <td className="py-1.5 pl-3 text-right tabular-nums">{t.fiches}</td>
                                            <td className="py-1.5 pl-3 text-right tabular-nums">{fmtKgH(t.kgParHeure)}</td>
                                            <td className="py-1.5 pl-3 text-right"><QualiteStars value={t.qualite} size="sm" /></td>
                                            <td className="py-1.5 pl-3 text-right tabular-nums"><EcartCount n={t.ecarts} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="min-w-0">
                <CardHeader>
                    <CardTitle className="text-base">Ce qui a été trié, par catégorie et par type</CardTitle>
                    <CardDescription className="flex items-start gap-1.5">
                        <Info size={14} className="mt-0.5 shrink-0" />
                        Cumul sur la période : poids trié par catégorie et kilos répartis par type, à consulter avant
                        de racheter. Ce n'est pas encore un stock —
                        les sorties de la salle de tri ne sont pas tracées dans cette version.
                    </CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                    <table className="w-full min-w-max text-sm">
                        <thead className="text-xs text-muted-foreground">
                            <tr className="border-b border-border">
                                <th className="py-2 pr-3 text-left font-medium">Catégorie</th>
                                {sortiesVisibles.map((s) => (
                                    <th key={s.id} className="px-2 py-2 text-right font-medium">
                                        <span className="inline-flex items-center gap-1.5">
                                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: sortieColor(s.id) }} aria-hidden />
                                            <span className="font-mono">{s.code}</span>
                                        </span>
                                    </th>
                                ))}
                                <th className="px-2 py-2 text-right font-medium">Poids trié</th>
                                <th className="py-2 pl-2 text-right font-medium">Qualité</th>
                            </tr>
                        </thead>
                        <tbody>
                            {a.parCategorie.map((c) => (
                                <tr key={c.categoryId} className="border-b border-border/60 last:border-0">
                                    <td className="py-1.5 pr-3 font-medium">{categoryName(c.categoryId)}</td>
                                    {sortiesVisibles.map((s) => (
                                        <td key={s.id} className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                                            {c.bySortie[s.id] ? formatKg(c.bySortie[s.id]) : "·"}
                                        </td>
                                    ))}
                                    <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{formatKg(c.kg)}</td>
                                    <td className="py-1.5 pl-2 text-right"><QualiteStars value={c.qualite} size="sm" /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </CardContent>
            </Card>

            <Card className="min-w-0">
                <CardHeader>
                    <CardTitle className="text-base">Par fournisseur</CardTitle>
                    <CardDescription>
                        Qualité des vêtements triés, balle par balle, pondérée par le poids — pour juger ce qu'envoie chaque fournisseur
                    </CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                    <table className="w-full min-w-max text-sm">
                        <thead className="text-xs text-muted-foreground">
                            <tr className="border-b border-border">
                                <th className="py-1.5 text-left font-medium">Fournisseur</th>
                                <th className="py-1.5 pl-3 text-right font-medium">Kilos</th>
                                <th className="py-1.5 pl-3 text-right font-medium">Balles</th>
                                <th className="py-1.5 pl-3 text-right font-medium">Qualité</th>
                                <th className="py-1.5 pl-3 text-right font-medium">Écarts</th>
                            </tr>
                        </thead>
                        <tbody>
                            {a.parFournisseur.map((f) => (
                                <tr key={f.id} className="border-b border-border/60 last:border-0">
                                    <td className="py-1.5 font-medium">{fournisseurName.get(f.id) ?? "?"}</td>
                                    <td className="py-1.5 pl-3 text-right tabular-nums">{formatKg(f.kg)}</td>
                                    <td className="py-1.5 pl-3 text-right tabular-nums">{f.balles}</td>
                                    <td className="py-1.5 pl-3 text-right">
                                        <span className="inline-flex items-center gap-2">
                                            <QualiteStars value={f.qualite} size="sm" />
                                            <span className="w-8 text-xs tabular-nums text-muted-foreground">{fmtQualite(f.qualite)}</span>
                                        </span>
                                    </td>
                                    <td className="py-1.5 pl-3 text-right tabular-nums"><EcartCount n={f.ecarts} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </CardContent>
            </Card>
        </div>
    )
}

const SEMAINE_MODES = [
    { id: "kg", label: "Kilos", icon: Scale },
    { id: "pct", label: "Parts", icon: Percent },
] as const

/**
 * Où partent les kilos triés : LA question de la salle de tri. Une barre
 * pleine largeur et, par type de sortie, sa part du réparti et ses kilos.
 * Chaque type garde sa couleur, la même partout dans la page.
 */
function RepartitionGlobale({ analytics: a }: { analytics: TriAnalytics }) {
    const { sortieById } = useTriContext()
    const color = useSortieColor()
    const ecart = a.totals.reparti - a.totals.kg
    const enEcart = Math.abs(ecart) >= TRI_ECART_SEUIL_KG
    const label = (id: string) => sortieById.get(id)?.code ?? "?"

    return (
        <Card className="min-w-0">
            <CardHeader>
                <CardTitle className="text-base">Où partent les kilos</CardTitle>
                <CardDescription>
                    {formatKg(a.totals.reparti)} répartis sur {formatKg(a.totals.kg)} triés
                    {enEcart && <span className="text-warning"> · écart {formatEcart(ecart)}</span>}
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <div
                    className="flex h-4 w-full overflow-hidden rounded-full bg-muted"
                    role="img"
                    aria-label={a.parSortie.map((p) => `${label(p.sortieId)} ${Math.round(p.pct)} %`).join(", ")}
                >
                    {a.parSortie.map((p) => (
                        // Largeur = donnée : posée en style inline, pas en classe.
                        <div
                            key={p.sortieId}
                            className="h-full border-r-2 border-card last:border-r-0"
                            style={{ width: `${p.pct}%`, backgroundColor: color(p.sortieId) }}
                        />
                    ))}
                </div>
                <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {a.parSortie.map((p) => (
                        <li key={p.sortieId} className="flex min-w-0 flex-col gap-1 rounded-lg border border-border p-3">
                            <span className="flex items-center gap-1.5 text-xs">
                                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color(p.sortieId) }} aria-hidden />
                                <span className="font-mono font-semibold">{label(p.sortieId)}</span>
                                <span className="truncate text-muted-foreground">{sortieById.get(p.sortieId)?.libelle}</span>
                            </span>
                            <span className="text-2xl font-bold tabular-nums tracking-tight">{Math.round(p.pct)} %</span>
                            <span className="text-xs tabular-nums text-muted-foreground">{formatKg(p.kg)}</span>
                        </li>
                    ))}
                </ul>
            </CardContent>
        </Card>
    )
}

/** Balles en écart d'un groupe : rien à zéro, une pastille d'alerte sinon. */
function EcartCount({ n }: { n: number }) {
    if (n === 0) return <span className="text-muted-foreground">·</span>
    return (
        <span className="inline-flex items-center gap-1 font-medium text-warning">
            <AlertTriangle size={12} aria-hidden />
            {n}
        </span>
    )
}
