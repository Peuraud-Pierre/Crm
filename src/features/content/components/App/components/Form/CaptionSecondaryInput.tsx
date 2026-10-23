import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"
import { useContent } from "@/features/content/context/ContentProvider"

export function CaptionSecondaryInput() {
    const { updateField, formData } = useContent()

    return (
        <div className="space-y-3 pt-4 border-t border-border">
            <div className="space-y-2">
                <Label htmlFor="secondary-caption-text">
                    Message secondaire (optionnel)
                </Label>
                <Input
                    id="secondary-caption-text"
                    placeholder="Ex.: Offre limitée aux 100 premiers !"
                    maxLength={120}
                    value={formData.secondaryCaptionText}
                    onChange={(e) =>
                        updateField("secondaryCaptionText", e.target.value)
                    }
                />
                <p className="text-right text-xs text-muted-foreground">
                    {formData.secondaryCaptionText.length}/120
                </p>
            </div>
        </div>
    )
}
