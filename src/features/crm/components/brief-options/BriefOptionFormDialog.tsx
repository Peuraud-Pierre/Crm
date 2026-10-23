import { useState } from "react"
import { ListPlus, Plus } from "lucide-react"
import { BRIEF_CATEGORIES, type BriefCategorie } from "@/features/crm/types"
import { Button } from "@/shared/ui/atoms/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/shared/ui/atoms/dialog"
import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"
import { CATEGORIE_LABELS } from "./categorieLabels"

/**
 * Dialog de création d'une option de brief : demande à la fois la valeur
 * (« la chose », ex. « Vinted ») et sa catégorie (« le type », ex.
 * « Plateformes ») — permet d'ajouter une valeur sans devoir localiser sa
 * section dédiée dans la grille de cartes.
 */
export function BriefOptionFormDialog({
    onSubmit,
}: {
    onSubmit: (categorie: BriefCategorie, value: string) => void
}) {
    const [open, setOpen] = useState(false)
    const [categorie, setCategorie] = useState<BriefCategorie>(
        BRIEF_CATEGORIES[0]
    )
    const [value, setValue] = useState("")

    function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
        e.preventDefault()
        const trimmed = value.trim()
        if (!trimmed) return
        onSubmit(categorie, trimmed)
        setValue("")
        setOpen(false)
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm">
                    <Plus className="w-4 h-4" />
                    Ajouter une option
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ListPlus className="w-5 h-5 text-primary" />
                        Ajouter une option de brief
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div
                        style={{ animationDelay: "0ms" }}
                        className="space-y-2 animate-in fade-in slide-in-from-bottom-1 fill-mode-backwards duration-base ease-out"
                    >
                        <Label htmlFor="brief-option-type">Type</Label>
                        <Select
                            value={categorie}
                            onValueChange={(v) =>
                                setCategorie(v as BriefCategorie)
                            }
                        >
                            <SelectTrigger id="brief-option-type">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {BRIEF_CATEGORIES.map((c) => (
                                    <SelectItem key={c} value={c}>
                                        {CATEGORIE_LABELS[c]}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div
                        style={{ animationDelay: "60ms" }}
                        className="space-y-2 animate-in fade-in slide-in-from-bottom-1 fill-mode-backwards duration-base ease-out"
                    >
                        <Label htmlFor="brief-option-value">Valeur</Label>
                        <Input
                            id="brief-option-value"
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            autoFocus
                            required
                        />
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setOpen(false)}
                        >
                            Annuler
                        </Button>
                        <Button type="submit">Enregistrer</Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
