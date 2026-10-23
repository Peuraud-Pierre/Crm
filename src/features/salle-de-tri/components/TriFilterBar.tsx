import { useMemo, useState, type ReactNode } from "react"
import { format, startOfMonth, subDays } from "date-fns"
import { AlertTriangle, Building2, Tags, UserRound, X } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import { Separator } from "@/shared/ui/atoms/separator"
import { FilterBar } from "@/shared/ui/organisms/filter-bar"
import { SearchSelect } from "@/shared/ui/molecules/search-select"
import { cn } from "@/shared/lib/utils"
import { GESTION_THEME, useReferentialContext } from "@/features/stock"
import { defaultTriFilters, useTriContext } from "@/features/salle-de-tri/hooks/context/TriContext"
import { countTriFilters } from "@/features/salle-de-tri/utils/triAnalytics"
import type { Qualite, TriFilters } from "@/features/salle-de-tri/types/tri.types"

const day = (d: Date) => format(d, "yyyy-MM-dd")

/** Raccourcis de période : la question est presque toujours « ces derniers temps ». */
const PERIODES: { id: string; label: string; range: () => { dateFrom: string; dateTo: string } }[] = [
    { id: "7j", label: "7 j", range: () => ({ dateFrom: day(subDays(new Date(), 7)), dateTo: "" }) },
    { id: "30j", label: "30 j", range: () => ({ dateFrom: day(subDays(new Date(), 30)), dateTo: "" }) },
    { id: "mois", label: "Ce mois", range: () => ({ dateFrom: day(startOfMonth(new Date())), dateTo: "" }) },
    { id: "90j", label: "90 j", range: () => ({ dateFrom: day(subDays(new Date(), 90)), dateTo: "" }) },
    { id: "tout", label: "Tout", range: () => ({ dateFrom: "", dateTo: "" }) },
]

const ALL = { value: "all", label: "Tous" }

interface TriFilterBarProps {
    /** Bascule de vues, rendue à gauche de la recherche. */
    leading: ReactNode
    trailing?: ReactNode
}

/**
 * Filtres de la salle de tri : qui, quand, d'où, quoi, quelle qualité,
 * quels écarts. Ils
 * s'appliquent à la fois au tableau et aux statistiques.
 */
export function TriFilterBar({ leading, trailing }: TriFilterBarProps) {
    const { filters, setFilters, trieurs, sorties } = useTriContext()
    const { fournisseurs, categories } = useReferentialContext()
    const [open, setOpen] = useState(false)

    const set = (partial: Partial<TriFilters>) => setFilters({ ...filters, ...partial })

    const trieurOptions = useMemo(() => [ALL, ...trieurs.map((t) => ({ value: t.id, label: t.nom, icon: UserRound }))], [trieurs])
    const fournisseurOptions = useMemo(() => [ALL, ...fournisseurs.map((f) => ({ value: f.id, label: f.name, icon: Building2 }))], [fournisseurs])
    const categoryOptions = useMemo(
        () => [{ value: "all", label: "Toutes" }, ...categories.filter((c) => c.name).map((c) => ({ value: c.id, label: c.name, icon: Tags }))],
        [categories],
    )

    const activePeriode = PERIODES.find((p) => {
        const r = p.range()
        return r.dateFrom === filters.dateFrom && r.dateTo === filters.dateTo
    })?.id
    // La période par défaut (30 jours) n'est pas un filtre posé par l'utilisateur.
    const activeCount = countTriFilters(filters) - (activePeriode === "30j" ? 1 : 0)

    return (
        <FilterBar
            theme={GESTION_THEME.filterBar}
            activeCount={activeCount}
            open={open}
            onOpenChange={setOpen}
            leading={leading}
            trailing={trailing}
            search={{
                value: filters.search,
                onChange: (search) => set({ search }),
                placeholder: "N° de fiche, trieur, catégorie, note…",
                ariaLabel: "Rechercher une fiche de tri",
            }}
        >
            <div className="flex flex-wrap items-end gap-x-2 gap-y-3">
                <SearchSelect label="Trieur" options={trieurOptions} value={filters.trieurId} onChange={(v) => set({ trieurId: v })} size="sm" className="w-full sm:w-40" />
                <SearchSelect label="Fournisseur" options={fournisseurOptions} value={filters.fournisseurId} onChange={(v) => set({ fournisseurId: v })} size="sm" className="w-full sm:w-44" />
                <SearchSelect label="Catégorie" options={categoryOptions} value={filters.categoryId} onChange={(v) => set({ categoryId: v })} size="sm" className="w-full sm:w-44" />

                <FilterGroup label="Type">
                    {[{ id: "all", code: "Tous" }, ...sorties].map((s) => (
                        <Chip key={s.id} pressed={filters.sortieId === s.id} onClick={() => set({ sortieId: s.id })} className="font-mono">
                            {s.code}
                        </Chip>
                    ))}
                </FilterGroup>

                <FilterGroup label="Qualité min.">
                    {([1, 2, 3] as Qualite[]).map((q) => (
                        <Chip key={q} pressed={filters.qualiteMin === q} onClick={() => set({ qualiteMin: q })}>
                            {q === 1 ? "Toutes" : `${"★".repeat(q)} et +`}
                        </Chip>
                    ))}
                </FilterGroup>

                <FilterGroup label="Écarts">
                    <Chip pressed={filters.ecartsSeuls} onClick={() => set({ ecartsSeuls: !filters.ecartsSeuls })} tone="warning">
                        <AlertTriangle size={12} aria-hidden />
                        Fiches en écart
                    </Chip>
                </FilterGroup>

                <Separator orientation="vertical" className="mx-1 hidden h-8 lg:block" />

                <FilterGroup label="Période" className="flex-wrap">
                    {PERIODES.map((p) => (
                        <Chip key={p.id} pressed={activePeriode === p.id} onClick={() => set(p.range())}>
                            {p.label}
                        </Chip>
                    ))}
                    <span className="flex items-center gap-2">
                        <Input type="date" aria-label="Début de période" value={filters.dateFrom} onChange={(e) => set({ dateFrom: e.target.value })} className="h-9 w-36 text-xs md:h-8" />
                        <span className="text-xs text-muted-foreground" aria-hidden>→</span>
                        <Input type="date" aria-label="Fin de période" value={filters.dateTo} min={filters.dateFrom} onChange={(e) => set({ dateTo: e.target.value })} className="h-9 w-36 text-xs md:h-8" />
                    </span>
                </FilterGroup>

                {activeCount > 0 && (
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setFilters({ ...defaultTriFilters(), search: filters.search })}
                        className="h-9 gap-1.5 text-xs text-muted-foreground hover:text-destructive md:h-8"
                    >
                        <X size={12} />
                        Réinitialiser
                    </Button>
                )}
            </div>
        </FilterBar>
    )
}

function FilterGroup({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
    return (
        <div className="flex flex-col gap-1.5">
            <span className={GESTION_THEME.filterBar.panelLabel}>{label}</span>
            <div className={cn("flex items-center gap-1", className)}>{children}</div>
        </div>
    )
}

interface ChipProps {
    pressed: boolean
    onClick: () => void
    tone?: "primary" | "warning"
    className?: string
    children: ReactNode
}

/** Bouton-bascule d'un filtre ; plus haut au doigt (tablette), dense à la souris. */
function Chip({ pressed, onClick, tone = "primary", className, children }: ChipProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={pressed}
            className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold transition-colors md:h-8 md:px-2",
                !pressed && "border-border bg-background text-muted-foreground hover:text-foreground",
                pressed && tone === "primary" && "border-primary bg-primary text-primary-foreground",
                pressed && tone === "warning" && "border-warning bg-warning text-warning-foreground",
                className,
            )}
        >
            {children}
        </button>
    )
}
