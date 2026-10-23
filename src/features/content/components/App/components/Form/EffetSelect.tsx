import { EFFECT_OPTIONS } from "@/features/content/components/App"
import { Label } from "@/shared/ui/atoms/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"
import { useContent } from "@/features/content/context/ContentProvider"

export function EffetSelect() {
    const { updateField, formData } = useContent()

    return (
        <div className="space-y-2">
            <Label>Effets</Label>
            <Select
                value={formData.effet}
                onValueChange={(value) => updateField("effet", value)}
            >
                <SelectTrigger className="h-11">
                    <SelectValue placeholder="Effets" />
                </SelectTrigger>
                <SelectContent>
                    {EFFECT_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                            {option.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    )
}
