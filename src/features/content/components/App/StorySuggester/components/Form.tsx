import {
    STORY_LANGUAGE_OPTIONS,
    STORY_PLATFORM_OPTIONS,
    STORY_STYLE_OPTIONS,
    STORY_TONE_OPTIONS,
} from "@/features/content/components/App"
import { useContent } from "@/features/content/context/ContentProvider"
import { Label } from "@/shared/ui/atoms/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"

export function Form() {
    const { formData, updateField } = useContent()

    return (
        <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
                <Label>Style</Label>
                <Select
                    value={formData.storyStyle}
                    onValueChange={(v) => updateField("storyStyle", v)}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Choisir un style" />
                    </SelectTrigger>
                    <SelectContent>
                        {STORY_STYLE_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                                {o.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label>Ton</Label>
                <Select
                    value={formData.storyTone}
                    onValueChange={(v) => updateField("storyTone", v)}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Choisir un ton" />
                    </SelectTrigger>
                    <SelectContent>
                        {STORY_TONE_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                                {o.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label>Plateforme</Label>
                <Select
                    value={formData.storyPlatform}
                    onValueChange={(v) => updateField("storyPlatform", v)}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Choisir une plateforme" />
                    </SelectTrigger>
                    <SelectContent>
                        {STORY_PLATFORM_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                                {o.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label>Langue</Label>
                <Select
                    value={formData.storyLanguage}
                    onValueChange={(v) => updateField("storyLanguage", v)}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Choisir une langue" />
                    </SelectTrigger>
                    <SelectContent>
                        {STORY_LANGUAGE_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                                {o.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>
    )
}
