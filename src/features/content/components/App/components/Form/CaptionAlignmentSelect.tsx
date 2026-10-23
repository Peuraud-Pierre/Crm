import { CAPTION_ALIGNMENT_OPTIONS } from "@/features/content/components/App"
import { Label } from "@/shared/ui/atoms/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"
import { useContent } from "@/features/content/context/ContentProvider"

export function CaptionAlignmentSelect() {
    const { updateField, formData } = useContent()

    return (
        <div className="space-y-2">
            <Label>Alignement</Label>
            <Select
                value={formData.captionAlignment}
                onValueChange={(value) =>
                    updateField("captionAlignment", value)
                }
            >
                <SelectTrigger className="h-11">
                    <SelectValue placeholder="Alignement" />
                </SelectTrigger>
                <SelectContent>
                    {CAPTION_ALIGNMENT_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                            {option.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    )
}
