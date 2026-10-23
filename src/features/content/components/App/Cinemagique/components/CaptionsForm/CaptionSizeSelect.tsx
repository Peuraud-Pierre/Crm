import { CAPTION_SIZE_OPTIONS } from "@/features/content/components/App"
import { Label } from "@/shared/ui/atoms/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"
import { useContent } from "@/features/content/context/ContentProvider"

export function CaptionSizeSelect() {
    const { formData, updateField } = useContent()

    return (
        <div className="space-y-2">
            <Label>Taille du texte</Label>
            <Select
                value={formData.captionSize}
                onValueChange={(value) => updateField("captionSize", value)}
            >
                <SelectTrigger className="h-11">
                    <SelectValue placeholder="Taille" />
                </SelectTrigger>
                <SelectContent>
                    {CAPTION_SIZE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                            {o.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    )
}
