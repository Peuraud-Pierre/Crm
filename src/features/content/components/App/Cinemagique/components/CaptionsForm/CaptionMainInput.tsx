import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"
import { useContent } from "@/features/content/context/ContentProvider"

export function CaptionMainInput() {
    const { formData, updateField } = useContent()

    return (
        <div className="space-y-2">
            <Label htmlFor="caption-text">Message principal</Label>
            <Input
                id="caption-text"
                placeholder="Ex.: Nouvelle collection dispo !"
                maxLength={60}
                value={formData.captionText}
                onChange={(e) => updateField("captionText", e.target.value)}
            />
            <p className="text-right text-xs text-muted-foreground">
                {formData.captionText.length}/60
            </p>
        </div>
    )
}
