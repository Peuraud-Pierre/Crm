import { Label } from "@/shared/ui/atoms/label"
import { Switch } from "@/shared/ui/atoms/switch"
import { useContent } from "@/features/content/context/ContentProvider"

export function CaptionsSwitch() {
    const { formData, updateField } = useContent()

    return (
        <div className="flex items-center gap-2">
            <Switch
                id="include-captions"
                checked={formData.includeCaptions}
                onCheckedChange={(v) =>
                    updateField("includeCaptions", Boolean(v))
                }
            />
            <Label htmlFor="include-captions">
                Ajouter des légendes (optionnel)
            </Label>
        </div>
    )
}
