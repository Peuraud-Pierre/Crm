import { Check, X } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"
import { useState } from "react"
import type { Fournisseur } from "@/features/stock/types/stock.types"

interface FournisseurEditRowProps {
    fourn:    Fournisseur
    onSave:   (payload: Partial<Omit<Fournisseur, "id" | "created_at">>) => void
    onCancel: () => void
}

export function FournisseurEditRow({ fourn, onSave, onCancel }: FournisseurEditRowProps) {
    const [name,  setName]  = useState(fourn.name)
    const [siege, setSiege] = useState(fourn.siege_localisation ?? "")
    const [tag,   setTag]   = useState(fourn.tag ?? "")

    const handleSave = () => {
        if (!name.trim()) return
        onSave({ name: name.trim(), siege_localisation: siege.trim(), tag: tag.trim() })
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
                        placeholder="Ex: Fournisseur A"
                        className="h-9 text-sm w-full"
                        autoFocus
                        onKeyDown={handleKeyDown}
                    />
                </div>

                {/* Groupe Localisation */}
                <div className="flex flex-col gap-1.5 flex-1 sm:max-w-xs">
                    <Label className="text-xs font-medium text-muted-foreground ml-0.5">
                        Localisation
                    </Label>
                    <Input
                        value={siege}
                        onChange={(e) => setSiege(e.target.value)}
                        placeholder="Ex: Paris"
                        className="h-9 text-sm w-full"
                        onKeyDown={handleKeyDown}
                    />
                </div>

                {/* Groupe Tag */}
                <div className="flex flex-col gap-1.5 w-full sm:w-32">
                    <Label className="text-xs font-medium text-muted-foreground ml-0.5">
                        Tag
                    </Label>
                    <Input
                        value={tag}
                        onChange={(e) => setTag(e.target.value)}
                        placeholder="Ex: F-01"
                        className="h-9 text-sm w-full font-mono"
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