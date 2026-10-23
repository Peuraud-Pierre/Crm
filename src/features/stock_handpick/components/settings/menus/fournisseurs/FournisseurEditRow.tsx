import { useState } from "react"
import { Check, X } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"
import { Switch } from "@/shared/ui/atoms/switch"
import { HANDPICK_THEME } from "@/features/stock_handpick/theme"
import type { FournisseurWithCategories } from "@/features/stock_handpick/types/referential.types"
import type { FournisseurWritable } from "@/features/stock_handpick/services/fournisseurHandpickService"

interface FournisseurEditRowProps {
    fournisseur: FournisseurWithCategories
    onSave: (payload: Partial<FournisseurWritable>) => void | Promise<void>
    onCancel: () => void
}

export function FournisseurEditRow({
    fournisseur,
    onSave,
    onCancel,
}: FournisseurEditRowProps) {
    const [name, setName] = useState(fournisseur.name)
    const [tag, setTag] = useState(fournisseur.tag ?? "")
    const [isActive, setIsActive] = useState(fournisseur.is_active)

    const handleSave = () => {
        if (!name.trim()) return
        // `siege_localisation` n'est plus écrit : une valeur historique reste
        // en base telle quelle.
        onSave({
            name: name.trim(),
            tag: tag.trim() || null,
            is_active: isActive,
        })
    }

    const handleKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === "Enter") handleSave()
        if (event.key === "Escape") onCancel()
    }

    return (
        <div className={HANDPICK_THEME.settings.editRow}>
            <div className="flex w-full flex-1 flex-col gap-3 sm:flex-row">
                <div className="flex flex-1 flex-col gap-1.5 sm:max-w-xs">
                    <Label className={HANDPICK_THEME.settings.fieldLabel}>Nom</Label>
                    <Input
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="Ex : Textiles SA"
                        className="h-9 w-full text-sm"
                        autoFocus
                        onKeyDown={handleKeyDown}
                    />
                </div>


                <div className="flex w-full flex-col gap-1.5 sm:w-24">
                    <Label className={HANDPICK_THEME.settings.fieldLabel}>Tag</Label>
                    <Input
                        value={tag}
                        onChange={(event) => setTag(event.target.value)}
                        placeholder="TEX"
                        className="h-9 w-full font-mono text-sm"
                        onKeyDown={handleKeyDown}
                    />
                </div>


                <div className="flex w-full shrink-0 items-center gap-2 border-t border-border pt-3 sm:w-auto sm:border-t-0 sm:border-l sm:pt-0 sm:pl-3">
                    <Switch
                        id={`active-${fournisseur.id}`}
                        checked={isActive}
                        onCheckedChange={setIsActive}
                    />
                    <Label
                        htmlFor={`active-${fournisseur.id}`}
                        className={HANDPICK_THEME.settings.fieldLabel}
                    >
                        Actif
                    </Label>
                </div>
            </div>

            <div className="flex w-full shrink-0 items-center justify-end gap-2 border-t border-border pt-3 sm:w-auto sm:border-t-0 sm:pt-0">
                <Button
                    size="sm"
                    className="h-9 w-full px-0 sm:w-9"
                    onClick={handleSave}
                    disabled={!name.trim()}
                    aria-label="Enregistrer"
                >
                    <Check size={16} />
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 w-full bg-muted px-0 text-muted-foreground hover:bg-muted sm:w-9 sm:bg-transparent"
                    onClick={onCancel}
                    aria-label="Annuler"
                >
                    <X size={16} />
                </Button>
            </div>
        </div>
    )
}
