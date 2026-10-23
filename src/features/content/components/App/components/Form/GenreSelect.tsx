import { GENRE_OPTIONS } from "@/features/content/components/App"
import { Label } from "@/shared/ui/atoms/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"
import { useContent } from "@/features/content/context/ContentProvider"

export function GenreSelect() {
    const { updateField, formData } = useContent()

    return (
        <div className="space-y-2">
            <Label>Genre</Label>
            <Select
                value={formData.genre}
                onValueChange={(value) => updateField("genre", value)}
            >
                <SelectTrigger className="h-11">
                    <SelectValue placeholder="Genre" />
                </SelectTrigger>
                <SelectContent>
                    {GENRE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                            {o.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    )
}
