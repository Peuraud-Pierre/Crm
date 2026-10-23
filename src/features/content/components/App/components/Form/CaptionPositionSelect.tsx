import { CAPTION_POSITION_OPTIONS } from "@/features/content/components/App"
import { Label } from "@/shared/ui/atoms/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"
import { useContent } from "@/features/content/context/ContentProvider"

export function CaptionPositionSelect() {
    const { updateField, formData } = useContent()

    return (
        <div className="space-y-2">
            <Label>Position verticale</Label>
            <Select
                value={formData.captionPosition}
                onValueChange={(value) => updateField("captionPosition", value)}
            >
                <SelectTrigger className="h-11">
                    <SelectValue placeholder="Position" />
                </SelectTrigger>
                <SelectContent>
                    {CAPTION_POSITION_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                            {option.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    )
}
