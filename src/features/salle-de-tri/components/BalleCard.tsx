import { memo, type KeyboardEvent } from "react"
import { Trash2 } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import { SearchSelect, type SearchSelectOption } from "@/shared/ui/molecules/search-select"
import { cn } from "@/shared/lib/utils"
import { parsePoids, type BalleDraft } from "@/features/salle-de-tri/utils/triDraft"
import type { TriSortie } from "@/features/salle-de-tri/types/tri.types"
import { QualiteStars } from "./QualiteStars"
import { RepartitionGauge } from "./RepartitionGauge"
import { useSortieColor } from "./RepartitionBar"

interface BalleCardProps {
    balle: BalleDraft
    index: number
    fournisseurOptions: SearchSelectOption[]
    categoryOptions: SearchSelectOption[]
    sorties: readonly TriSortie[]
    /** Problème bloquant à afficher (après une tentative d'enregistrement). */
    probleme: string | null
    onPatch: (key: string, partial: Partial<BalleDraft>) => void
    onRemove: (key: string) => void
    /** `Entrée` dans la note : balle suivante. */
    onNext: (index: number) => void
}

/** Champ en kg : texte pendant la frappe, unité en suffixe. */
const kgInputClass = "h-10 pr-9 text-right tabular-nums"

/**
 * Une balle de la feuille : ce qui a été ouvert (fournisseur, catégorie,
 * poids initial, qualité), puis où ses kilos sont partis — un champ par type de sortie,
 * dans l'ordre du référentiel — et la jauge qui montre ce qu'il reste à
 * répartir. La note appartient à la balle.
 *
 * Clavier : `Entrée` fait avancer d'un champ (poids → première sortie →
 * sorties suivantes → note → balle suivante).
 */
export const BalleCard = memo(function BalleCard({
    balle, index, fournisseurOptions, categoryOptions, sorties, probleme, onPatch, onRemove, onNext,
}: BalleCardProps) {
    const color = useSortieColor()
    const n = index + 1
    const patch = (partial: Partial<BalleDraft>) => onPatch(balle.key, partial)

    // L'ordre de saisie est celui du DOM : on avance au champ suivant de la carte.
    const advance = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key !== "Enter") return
        event.preventDefault()
        const card = event.currentTarget.closest("[data-balle]")
        const fields = [...(card?.querySelectorAll<HTMLInputElement>("[data-advance]") ?? [])]
        const next = fields[fields.indexOf(event.currentTarget) + 1]
        if (next) next.focus()
        else onNext(index)
    }

    const parts = sorties.map((s) => ({ sortieId: s.id, kg: parsePoids(balle.repartition[s.id] ?? "") ?? 0 }))

    return (
        <section
            data-balle={balle.key}
            aria-label={`Balle ${n}`}
            className={cn(
                "flex flex-col gap-4 rounded-xl border bg-card p-3 sm:p-4",
                probleme ? "border-destructive/50" : "border-border",
            )}
        >
            <header className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-semibold">Balle {n}</h4>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive md:h-8 md:w-8"
                    aria-label={`Retirer la balle ${n}`}
                    onClick={() => onRemove(balle.key)}
                >
                    <Trash2 size={15} />
                </Button>
            </header>

            <div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-12">
                <div className="col-span-2 flex flex-col gap-1.5 sm:col-span-6 lg:col-span-4">
                    <span className="text-xs font-medium text-muted-foreground">Fournisseur</span>
                    <SearchSelect
                        options={fournisseurOptions}
                        value={balle.fournisseur_id}
                        onChange={(value) => patch({ fournisseur_id: value })}
                        placeholder="Choisir un fournisseur"
                        size="md"
                        variant="input"
                        emptyMessage="Aucun fournisseur"
                    />
                </div>

                <div className="col-span-2 flex flex-col gap-1.5 sm:col-span-6 lg:col-span-4">
                    <span className="text-xs font-medium text-muted-foreground">Catégorie</span>
                    <SearchSelect
                        options={categoryOptions}
                        value={balle.category_id}
                        onChange={(value) => patch({ category_id: value })}
                        placeholder="Choisir une catégorie"
                        size="md"
                        variant="input"
                        emptyMessage="Aucune catégorie"
                    />
                </div>

                <label className="flex flex-col gap-1.5 sm:col-span-6 lg:col-span-2">
                    <span className="text-xs font-medium text-muted-foreground">Poids initial</span>
                    <span className="relative">
                        <Input
                            data-advance
                            data-poids={balle.key}
                            value={balle.poids}
                            onChange={(e) => patch({ poids: e.target.value })}
                            onKeyDown={advance}
                            inputMode="decimal"
                            placeholder="0"
                            aria-label={`Poids initial balle ${n} (kg)`}
                            className={kgInputClass}
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">kg</span>
                    </span>
                </label>

                <div className="flex flex-col gap-1.5 sm:col-span-6 lg:col-span-2">
                    <span className="text-xs font-medium text-muted-foreground">Qualité</span>
                    <div className="flex h-10 items-center">
                        <QualiteStars value={balle.qualite} onChange={(q) => patch({ qualite: q })} label={`Qualité balle ${n}`} />
                    </div>
                </div>
            </div>

            <fieldset className="flex flex-col gap-2.5">
                <legend className="mb-2 text-xs font-medium text-muted-foreground">Répartition</legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {sorties.map((s) => (
                        <label
                            key={s.id}
                            title={s.libelle}
                            className="flex h-10 items-center rounded-md border border-input bg-background pl-2.5 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30"
                        >
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color(s.id) }} aria-hidden />
                            <span className="ml-1.5 shrink-0 font-mono text-xs font-semibold">{s.code}</span>
                            <input
                                data-advance
                                value={balle.repartition[s.id] ?? ""}
                                onChange={(e) => patch({ repartition: { ...balle.repartition, [s.id]: e.target.value } })}
                                onKeyDown={advance}
                                inputMode="decimal"
                                placeholder="0"
                                aria-label={`${s.code} balle ${n} (kg)`}
                                className="h-full min-w-0 flex-1 bg-transparent px-2 text-right text-sm tabular-nums outline-none placeholder:text-muted-foreground/60"
                            />
                            <span className="pr-2.5 text-xs text-muted-foreground">kg</span>
                        </label>
                    ))}
                </div>
                <RepartitionGauge parts={parts} initial={parsePoids(balle.poids)} />
            </fieldset>

            <Input
                data-advance
                value={balle.note}
                onChange={(e) => patch({ note: e.target.value })}
                onKeyDown={advance}
                placeholder="Note sur la balle (humide, taches, mélange…)"
                aria-label={`Note balle ${n}`}
                className="h-10 text-sm"
            />

            {probleme && <p className="text-xs font-medium text-destructive">Balle {n} : {probleme}</p>}
        </section>
    )
})
