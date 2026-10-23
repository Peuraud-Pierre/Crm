import { Label } from "@/shared/ui/atoms/label"
import { Switch } from "@/shared/ui/atoms/switch"
import { useContent } from "@/features/content/context/ContentProvider"

export function AudioSwitch() {
    const { formData, updateField } = useContent()

    return (
        <div className="flex items-center gap-2">
            <Switch
                id="include-audio"
                checked={formData.includeAudio}
                onCheckedChange={(v) => updateField("includeAudio", Boolean(v))}
            />
            <Label htmlFor="include-audio">Ajouter du son (optionnel)</Label>
        </div>
    )
}
