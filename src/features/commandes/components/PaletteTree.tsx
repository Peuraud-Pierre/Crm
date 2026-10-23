import { useState } from "react"
import { ChevronDown, ChevronRight, Layers, Package, Plus, Trash2 } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { cn } from "@/shared/lib/utils"
import { CARTON_ETAT_LABEL } from "@/features/commandes/constants"
import { useCommandeContext } from "@/features/commandes/hooks/context/CommandeContext"
import { formatPaletteCode } from "@/features/commandes/utils/commandeCode"
import { recapCartons } from "@/features/commandes/utils/commandeAvancement"
import type { Carton, LivraisonBoutique, Palette } from "@/features/commandes/types/commande.types"
import { CartonBadge } from "./commandeUi"

interface PaletteTreeProps {
    livraison: LivraisonBoutique
    palettes: readonly Palette[]
    cartons: readonly Carton[]
    /** Livraison pas encore partie : contenu modifiable. */
    editable: boolean
}

const kg = (v: number) => `${v.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} kg`

/**
 * La livraison en arbre : palettes, puis leurs cartons. Avant le départ on
 * y prépare (ajouter une palette, déplacer ou retirer un carton) ; après, on
 * y lit l'état de réception de chaque carton.
 */
export function PaletteTree({ livraison, palettes, cartons, editable }: PaletteTreeProps) {
    const { addPalette, deletePalette } = useCommandeContext()
    const groupes = [
        ...palettes.map((p) => ({ palette: p as Palette | null, cartons: cartons.filter((c) => c.palette_id === p.id) })),
        { palette: null, cartons: cartons.filter((c) => !c.palette_id) },
    ].filter((g) => g.palette !== null || g.cartons.length > 0)

    return (
        <div className="flex flex-col gap-2">
            {groupes.map((g) => (
                <PaletteNode
                    key={g.palette?.id ?? "hors"}
                    livraison={livraison}
                    palette={g.palette}
                    cartons={g.cartons}
                    palettes={palettes}
                    editable={editable}
                    onDelete={g.palette && editable ? () => deletePalette(g.palette!.id) : undefined}
                />
            ))}
            {editable && (
                <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => addPalette(livraison.id)}>
                    <Plus size={14} />
                    Nouvelle palette
                </Button>
            )}
            {groupes.length === 0 && !editable && <p className="text-sm text-muted-foreground">Aucun carton.</p>}
        </div>
    )
}

function PaletteNode({ livraison, palette, cartons, palettes, editable, onDelete }: {
    livraison: LivraisonBoutique
    palette: Palette | null
    cartons: readonly Carton[]
    palettes: readonly Palette[]
    editable: boolean
    onDelete?: () => Promise<boolean>
}) {
    const [open, setOpen] = useState(true)
    const recap = recapCartons(cartons)
    const recus = cartons.filter((c) => c.statut === "recu_conforme" || c.statut === "recu_ecart").length
    const titre = palette ? `Palette ${palette.numero}` : "Hors palette"

    return (
        <div className="overflow-hidden rounded-xl border border-border">
            <div className="flex items-center gap-2 bg-muted/40 px-3 py-2">
                <button type="button" onClick={() => setOpen(!open)} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={open}>
                    {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    {palette ? <Layers size={14} className="text-muted-foreground" /> : <Package size={14} className="text-muted-foreground" />}
                    <span className="font-semibold">{titre}</span>
                    {palette && <span className="hidden font-mono text-xs text-muted-foreground sm:inline">{formatPaletteCode(livraison.numero, palette.numero)}</span>}
                </button>
                <span className="text-xs tabular-nums text-muted-foreground">
                    {recap.cartons} carton{recap.cartons > 1 ? "s" : ""} · {kg(recap.kg)}
                    {!editable && recap.cartons > 0 && ` · ${recus}/${recap.cartons} reçus`}
                </span>
                {onDelete && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        aria-label={`Supprimer la ${titre.toLowerCase()} (ses cartons restent dans la livraison)`}
                        title="Supprimer la palette — ses cartons passent hors palette"
                        onClick={() => void onDelete()}
                    >
                        <Trash2 size={13} />
                    </Button>
                )}
            </div>
            {open && (
                cartons.length === 0
                    ? <p className="px-3 py-3 text-xs text-muted-foreground">Palette vide : ajoutez-y des cartons ci-dessus.</p>
                    : (
                        <ul className="divide-y divide-border">
                            {cartons.map((c) => <CartonRow key={c.id} carton={c} palettes={palettes} editable={editable} />)}
                        </ul>
                    )
            )}
            {open && recap.parCategorie.length > 1 && (
                <p className="border-t border-border px-3 py-1.5 text-xs text-muted-foreground">
                    {recap.parCategorie.map((p) => `${p.nom} ${kg(p.kg)}`).join(" · ")}
                </p>
            )}
        </div>
    )
}

function CartonRow({ carton, palettes, editable }: { carton: Carton; palettes: readonly Palette[]; editable: boolean }) {
    const { updateCarton, deleteCarton } = useCommandeContext()
    const ecart = carton.statut === "recu_ecart" || carton.statut === "manquant"

    return (
        <li className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm", ecart && "bg-destructive/5")}>
            <span className="w-28 shrink-0 font-mono text-xs font-semibold">{carton.code}</span>
            <span className="min-w-0 flex-1 truncate font-medium">{carton.category_nom}</span>
            <span className="w-20 text-right tabular-nums">
                {carton.poids_kg_recu !== null && carton.poids_kg_recu !== carton.poids_kg_prevu
                    ? <><s className="text-muted-foreground">{kg(carton.poids_kg_prevu)}</s> {kg(carton.poids_kg_recu)}</>
                    : kg(carton.poids_kg_prevu)}
            </span>
            {editable ? (
                <span className="flex items-center gap-1">
                    <select
                        aria-label={`Palette du carton ${carton.code}`}
                        value={carton.palette_id ?? ""}
                        onChange={(e) => void updateCarton(carton.id, { palette_id: e.target.value || null })}
                        className="h-7 rounded-md border border-input bg-background px-1.5 text-xs"
                    >
                        <option value="">Hors palette</option>
                        {palettes.map((p) => <option key={p.id} value={p.id}>Palette {p.numero}</option>)}
                    </select>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        aria-label={`Retirer le carton ${carton.code}`} onClick={() => void deleteCarton(carton.id)}>
                        <Trash2 size={13} />
                    </Button>
                </span>
            ) : (
                <span className="flex items-center gap-2">
                    <CartonBadge statut={carton.statut} />
                    {carton.etat && carton.etat !== "conforme" && carton.etat !== "manquant" && (
                        <span className="text-xs font-medium text-destructive">{CARTON_ETAT_LABEL[carton.etat]}</span>
                    )}
                </span>
            )}
            {carton.note_reception && <span className="basis-full text-xs sm:pl-28 italic text-muted-foreground">« {carton.note_reception} »</span>}
        </li>
    )
}
