import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"
import { useContent } from "@/features/content/context/ContentProvider"

export function BrandInput() {
    const { formData, updateField } = useContent()

    return (
        <div className="space-y-2">
            <Label htmlFor="couleur">Brand</Label>
            <Input
                id="couleur"
                placeholder="Ex: Levi's"
                value={formData.couleur}
                onChange={(e) => updateField("couleur", e.target.value)}
            />
        </div>
    )
}
