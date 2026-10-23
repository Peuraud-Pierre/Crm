import { useMemo, useState } from "react"
import { PackagePlus, Wand2 } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"
import { CARTON_POIDS_TYPE } from "@/features/commandes/constants"
import { useCommandeContext } from "@/features/commandes/hooks/context/CommandeContext"
import { decouperEnCartons, formatKg } from "@/features/commandes/utils/commandeAvancement"
import { parsePoids } from "@/shared/utils/poids"
import type { AvancementLigne, CartonInput, Palette } from "@/features/commandes/types/commande.types"
import { CategoriePicker } from "./CategoriePicker"

interface CartonQuickAddProps {
    livraisonId: string
    palettes: readonly Palette[]
    /** Reste à servir de la commande rattachée, pour les propositions. */
    reste: readonly AvancementLigne[]
}

/**
 * Préparation rapide : une catégorie, un poids, un nombre de cartons
 * identiques, une palette. Si la livraison sert une commande, chaque
 * catégorie encore due est proposée, découpée en cartons du poids type —
 * un clic prépare le reste.
 */
export function CartonQuickAdd({ livraisonId, palettes, reste }: CartonQuickAddProps) {
    const { addCartons } = useCommandeContext()
    const [categoryId, setCategoryId] = useState("")
    const [poids, setPoids] = useState(String(CARTON_POIDS_TYPE))
    const [nombre, setNombre] = useState("1")
    const [paletteId, setPaletteId] = useState<string>("")
    const [busy, setBusy] = useState(false)

    const poidsKg = parsePoids(poids)
    const n = Number(nombre)
    const valid = !!categoryId && poidsKg !== null && Number.isInteger(n) && n >= 1 && n <= 99

    const add = async (cartons: CartonInput[]) => {
        setBusy(true)
        const ok = await addCartons(cartons)
        setBusy(false)
        return ok
    }

    const submit = async () => {
        if (!valid || poidsKg === null) return
        const carton: CartonInput = { livraison_id: livraisonId, palette_id: paletteId || null, category_id: categoryId, poids_kg_prevu: poidsKg }
        if (await add(Array.from({ length: n }, () => carton))) setNombre("1")
    }

    const propositions = useMemo(
        () => reste
            .filter((l) => l.kg_reste > 0)
            .map((l) => ({ ligne: l, cartons: decouperEnCartons(l.kg_reste, CARTON_POIDS_TYPE) })),
        [reste],
    )

    return (
        <div className="flex flex-col gap-3 rounded-xl border border-dashed border-primary/30 bg-primary/5 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
                <PackagePlus size={16} />
                Ajouter des cartons
            </div>

            {propositions.length > 0 && (
                <div className="flex flex-col gap-1.5">
                    <span className="text-xs text-muted-foreground">Reste à servir sur la commande — un clic prépare les cartons :</span>
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                        {propositions.map(({ ligne, cartons }) => (
                            <Button
                                key={ligne.ligne_id}
                                type="button"
                                variant="outline"
                                disabled={busy}
                                className="h-auto justify-start gap-2 py-2 text-left"
                                title={`Préparer ${cartons.length} carton(s) : ${cartons.join(" + ")} kg`}
                                onClick={() => add(cartons.map((kg) => ({
                                    livraison_id: livraisonId, palette_id: paletteId || null, category_id: ligne.category_id, poids_kg_prevu: kg,
                                })))}
                            >
                                <Wand2 size={14} className="shrink-0" />
                                <span className="min-w-0 flex-1 truncate font-medium">{ligne.category_nom}</span>
                                <span className="text-xs tabular-nums text-muted-foreground">
                                    {formatKg(ligne.kg_reste)} → {cartons.length} carton{cartons.length > 1 ? "s" : ""}
                                </span>
                            </Button>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-2 gap-2 lg:grid-cols-12 lg:items-end">
                <div className="col-span-2 flex flex-col gap-1.5 lg:col-span-5">
                    <Label className="text-xs text-muted-foreground">Catégorie</Label>
                    <CategoriePicker value={categoryId} onChange={setCategoryId} />
                </div>
                <div className="flex flex-col gap-1.5 lg:col-span-2">
                    <Label htmlFor="qa-poids" className="text-xs text-muted-foreground">Poids / carton (kg)</Label>
                    <Input id="qa-poids" value={poids} onChange={(e) => setPoids(e.target.value)} inputMode="decimal" className="h-10 text-right tabular-nums" />
                </div>
                <div className="flex flex-col gap-1.5 lg:col-span-2">
                    <Label htmlFor="qa-n" className="text-xs text-muted-foreground">Nombre</Label>
                    <Input id="qa-n" value={nombre} onChange={(e) => setNombre(e.target.value)} inputMode="numeric" className="h-10 text-right tabular-nums" />
                </div>
                <div className="col-span-2 flex flex-col gap-1.5 sm:col-span-1 lg:col-span-3">
                    <Label htmlFor="qa-pal" className="text-xs text-muted-foreground">Palette</Label>
                    <select
                        id="qa-pal"
                        value={paletteId}
                        onChange={(e) => setPaletteId(e.target.value)}
                        className="h-10 rounded-md border border-input bg-background px-2 text-sm"
                    >
                        <option value="">Hors palette</option>
                        {palettes.map((p) => <option key={p.id} value={p.id}>Palette {p.numero}</option>)}
                    </select>
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                    {categoryId && poidsKg !== null && n >= 1
                        ? `${n} × ${poidsKg} kg = ${formatKg(n * poidsKg)}`
                        : "Choisissez une catégorie."}
                </p>
                <Button type="button" size="sm" onClick={submit} disabled={!valid || busy}>
                    <PackagePlus size={14} />
                    Ajouter {n > 1 ? `${n} cartons` : "le carton"}
                </Button>
            </div>
        </div>
    )
}
