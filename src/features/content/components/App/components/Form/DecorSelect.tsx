import { DECOR_OPTIONS } from "@/features/content/components/App"
import { Label } from "@/shared/ui/atoms/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"
import { useContent } from "@/features/content/context/ContentProvider"

export function DecorSelect() {
    const { updateField, formData } = useContent()

    const handleDecorSelect = (value: string) => {
        updateField("decorChoice", value)
    }

    return (
        <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="decor-choice">Décor</Label>
            <Select
                value={formData.decorChoice}
                onValueChange={handleDecorSelect}
            >
                <SelectTrigger id="decor-choice" className="h-11">
                    <SelectValue placeholder="Décor" />
                </SelectTrigger>
                <SelectContent>
                    {DECOR_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                            {option.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    )
}
