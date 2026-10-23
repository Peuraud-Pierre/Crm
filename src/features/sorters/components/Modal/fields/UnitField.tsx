import { Label } from "@/shared/ui/atoms/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"

export function UnitField({
    unit,
    setUnit,
}: {
    unit: string
    setUnit: (value: "kg" | "pieces") => void
}) {
    return (
        <div>
            <Label>Unité de mesure</Label>
            <Select
                value={unit}
                onValueChange={(v) => setUnit(v as "kg" | "pieces")}
            >
                <SelectTrigger>
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="kg">Kilogrammes (kg)</SelectItem>
                    <SelectItem value="pieces">Pièces</SelectItem>
                </SelectContent>
            </Select>
        </div>
    )
}
