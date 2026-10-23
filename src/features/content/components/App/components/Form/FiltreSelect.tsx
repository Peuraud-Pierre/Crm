import { FILTER_OPTIONS } from "@/features/content/components/App"
import { Label } from "@/shared/ui/atoms/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"
import { useContent } from "@/features/content/context/ContentProvider"

export function FiltreSelect() {
    const { updateField, formData } = useContent()
    return (
        <div className="space-y-2">
            <Label>Filtre</Label>
            <Select
                value={formData.filtre}
                onValueChange={(value) => updateField("filtre", value)}
            >
                <SelectTrigger className="h-11">
                    <SelectValue placeholder="Filtre" />
                </SelectTrigger>
                <SelectContent>
                    {FILTER_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                            {option.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    )
}
