import { HIGHLIGHT_COLOR_OPTIONS } from "@/features/content/components/App"
import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"
import { useContent } from "@/features/content/context/ContentProvider"

export function CaptionHighlightInput() {
    const {
        updateField,
        formData: { highlightText, highlightColor },
    } = useContent()

    return (
        <div className="space-y-3 pt-4 border-t border-border">
            <div className="space-y-2">
                <Label htmlFor="highlight-text">
                    Mot à colorer (optionnel)
                </Label>
                <Input
                    id="highlight-text"
                    placeholder="Ex.: collection"
                    maxLength={30}
                    value={highlightText}
                    onChange={(e) =>
                        updateField("highlightText", e.target.value)
                    }
                />
                <p className="text-right text-xs text-muted-foreground">
                    {highlightText.length}/30
                </p>
            </div>

            <div className="space-y-2">
                <Label>Couleur</Label>
                <Select
                    value={highlightColor}
                    onValueChange={(value) =>
                        updateField("highlightColor", value)
                    }
                >
                    <SelectTrigger className="h-11">
                        <SelectValue placeholder="Couleur" />
                    </SelectTrigger>
                    <SelectContent>
                        {HIGHLIGHT_COLOR_OPTIONS.map((option) => (
                            <SelectItem
                                key={option.value}
                                value={option.value}
                                className="flex items-center gap-2"
                            >
                                <span
                                    className="inline-block w-3 h-3 rounded-full"
                                    style={{ backgroundColor: option.value }}
                                />
                                <span style={{ color: option.value }}>
                                    {option.label}
                                </span>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>
    )
}
