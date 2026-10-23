import type { BalleCategory } from "@/features/stock/types/stock.types"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"
import { Check, X } from "lucide-react"
import { useState } from "react"

interface EditRowProps {
    cat:      BalleCategory
    onSave:   (payload: Partial<Omit<BalleCategory, "id">>) => void
    onCancel: () => void
}

export function CategoryEditRow({ cat, onSave, onCancel }: EditRowProps) {
    const [name, setName]             = useState(cat.name)
    const [tag, setTag]               = useState(cat.tag ?? "")
    const [unitPrice, setUnitPrice]   = useState(String(cat.unit_price ?? ""))
    const [unitWeight, setUnitWeight] = useState(String(cat.unit_weight ?? ""))

    const handleSave = () => {
        if (!name.trim()) return
        onSave({
            name:        name.trim(),
            tag:         tag.trim(),
            unit_price:  unitPrice  ? parseFloat(unitPrice)  : 0,
            unit_weight: unitWeight ? parseFloat(unitWeight) : 0,
        })
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter")  handleSave()
        if (e.key === "Escape") onCancel()
    }

    return (
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 p-3 rounded-lg border-2 border-primary/20 bg-primary/5 dark:bg-primary/10">
            
            <div className="flex flex-col sm:flex-row flex-1 w-full gap-3">
                {/* Groupe Nom */}
                <div className="flex flex-col gap-1.5 flex-1 sm:max-w-xs">
                    <Label className="text-xs font-medium text-muted-foreground ml-0.5">
                        Nom
                    </Label>
                    <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ex: Vêtements"
                        // Cosmétique : c'est le service qui normalise. Le champ
                        // montre la forme qui sera enregistrée.
                        className="h-9 text-sm w-full uppercase"
                        autoFocus
                        onKeyDown={handleKeyDown}
                    />
                </div>

                {/* Groupe Tag */}
                <div className="flex flex-col gap-1.5 w-full sm:w-28">
                    <Label className="text-xs font-medium text-muted-foreground ml-0.5">
                        Tag
                    </Label>
                    <Input
                        value={tag}
                        onChange={(e) => setTag(e.target.value)}
                        placeholder="Ex: VET"
                        className="h-9 text-sm w-full font-mono"
                        onKeyDown={handleKeyDown}
                    />
                </div>

                {/* Groupe Prix unitaire */}
                <div className="flex flex-col gap-1.5 w-full sm:w-32">
                    <Label className="text-xs font-medium text-muted-foreground ml-0.5">
                        Prix unit. (€)
                    </Label>
                    <Input
                        value={unitPrice}
                        onChange={(e) => setUnitPrice(e.target.value)}
                        placeholder="0.00"
                        type="number"
                        className="h-9 text-sm w-full"
                        onKeyDown={handleKeyDown}
                    />
                </div>

                {/* Groupe Poids unitaire */}
                <div className="flex flex-col gap-1.5 w-full sm:w-32">
                    <Label className="text-xs font-medium text-muted-foreground ml-0.5">
                        Poids unit. (kg)
                    </Label>
                    <Input
                        value={unitWeight}
                        onChange={(e) => setUnitWeight(e.target.value)}
                        placeholder="0.00"
                        type="number"
                        className="h-9 text-sm w-full"
                        onKeyDown={handleKeyDown}
                    />
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end w-full sm:w-auto gap-2 shrink-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-border">
                <Button
                    size="sm"
                    className="h-9 w-full sm:w-9 px-0"
                    onClick={handleSave}
                    disabled={!name.trim()}
                >
                    <Check size={16} />
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 w-full sm:w-9 px-0 text-muted-foreground bg-muted sm:bg-transparent hover:bg-muted"
                    onClick={onCancel}
                >
                    <X size={16} />
                </Button>
            </div>
            
        </div>
    )
}