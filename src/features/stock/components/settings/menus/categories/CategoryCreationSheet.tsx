import { Tag } from "lucide-react"
import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"
import { FormSheet } from "@/shared/ui/organisms/form-sheet"
import { useMemo, useState } from "react"
import { buildCategoryTag } from "@/features/stock/utils/categoryNaming"
import type { BalleCategory } from "@/features/stock/types/stock.types"

interface CategoryCreationSheetProps {
    open:     boolean
    onClose:  () => void
    onCreate: (payload: Omit<BalleCategory, "id">) => Promise<BalleCategory | null>
    /** Tags déjà pris — sert à prévisualiser celui qui sera déduit du nom. */
    takenTags: (string | null)[]
}

export function CategoryCreationSheet({ open, onClose, onCreate, takenTags }: CategoryCreationSheetProps) {
    const [name, setName]             = useState("")
    const [tag, setTag]               = useState("")
    const [unitPrice, setUnitPrice]   = useState("")
    const [unitWeight, setUnitWeight] = useState("")
    const [loading, setLoading]       = useState(false)

    const reset = () => {
        setName("")
        setTag("")
        setUnitPrice("")
        setUnitWeight("")
    }

    const handleClose = () => { reset(); onClose() }

    // Ce que le service déduira si le champ reste vide. Affiché plutôt que
    // deviné : le tag finit dans les BIN, il ne doit pas être une surprise.
    const derivedTag = useMemo(
        () => (name.trim() ? buildCategoryTag(name, takenTags) : null),
        [name, takenTags],
    )

    const handleCreate = async () => {
        if (!name.trim()) return
        setLoading(true)
        const created = await onCreate({
            name:        name.trim(),
            tag:         tag.trim(),
            unit_price:  unitPrice  ? parseFloat(unitPrice)  : 0,
            unit_weight: unitWeight ? parseFloat(unitWeight) : 0,
        })
        setLoading(false)
        // `null` = échec déjà signalé : garder la saisie plutôt que de la vider.
        if (created) handleClose()
    }

    return (
        <FormSheet
            open={open}
            onClose={handleClose}
            icon={Tag}
            title="Nouvelle catégorie"
            size="md"
            onSubmit={handleCreate}
            submitDisabled={!name.trim()}
            loading={loading}
        >

                <div className="flex flex-col gap-5 flex-1 mt-4">
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="cat-name" className="text-sm font-semibold">
                            Nom <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="cat-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Ex : Vêtements homme"
                            // `uppercase` est cosmétique : c'est le service qui
                            // met le nom en majuscules. Le champ montre juste
                            // dès la saisie la forme qui sera enregistrée.
                            className="h-10 uppercase"
                            autoFocus
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <Label htmlFor="cat-tag" className="text-sm font-semibold">
                            Tag de référence
                        </Label>
                        <Input
                            id="cat-tag"
                            value={tag}
                            onChange={(e) => setTag(e.target.value)}
                            placeholder={derivedTag ?? "Déduit du nom"}
                            className="font-mono h-10 uppercase"
                            maxLength={8}
                        />
                        <p className="text-xs text-muted-foreground">
                            Identifiant court repris dans les références des balles (BIN), qui n'en
                            lisent que les 4 premiers caractères. Laissé vide, il est déduit du nom
                            {derivedTag ? ` — ici « ${derivedTag} »` : ""}. Modifiable à tout moment.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="cat-price" className="text-sm font-semibold">
                                Prix unitaire (€)
                            </Label>
                            <Input
                                id="cat-price"
                                type="number"
                                value={unitPrice}
                                onChange={(e) => setUnitPrice(e.target.value)}
                                placeholder="0.00"
                                className="h-10"
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="cat-weight" className="text-sm font-semibold">
                                Poids unitaire (kg)
                            </Label>
                            <Input
                                id="cat-weight"
                                type="number"
                                value={unitWeight}
                                onChange={(e) => setUnitWeight(e.target.value)}
                                placeholder="0.00"
                                className="h-10"
                            />
                        </div>
                    </div>
                </div>

        </FormSheet>
    )
}