import { CHEVEUX_OPTIONS } from "@/features/content/components/App"
import { Label } from "@/shared/ui/atoms/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"
import { useContent } from "@/features/content/context/ContentProvider"

export function CheveuxSelect() {
    const { updateField, formData } = useContent()

    return (
        <div className="space-y-2">
            <Label>Cheveux</Label>
            <Select
                value={formData.cheveux}
                onValueChange={(value) => updateField("cheveux", value)}
            >
                <SelectTrigger className="h-11">
                    <SelectValue placeholder="Cheveux" />
                </SelectTrigger>
                <SelectContent>
                    {CHEVEUX_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                            {option.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    )
}
