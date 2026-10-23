import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"
import { useContent } from "@/features/content/context/ContentProvider"

export function NameInput() {
    const { formData, updateField } = useContent()

    return (
        <div className="space-y-2">
            <Label htmlFor="nom">Type of clothing</Label>
            <Input
                id="nom"
                placeholder="Ex: Shirt"
                value={formData.nom}
                onChange={(e) => updateField("nom", e.target.value)}
            />
        </div>
    )
}
