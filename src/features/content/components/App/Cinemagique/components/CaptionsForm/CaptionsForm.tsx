import { CaptionAlignmentSelect } from "./CaptionAlignmentSelect"
import { CaptionHighlightInput } from "./CaptionHighlightInput"
import { CaptionMainInput } from "./CaptionMainInput"
import { CaptionPositionSelect } from "./CaptionPositionSelect"
import { CaptionSecondaryInput } from "./CaptionSecondaryInput"
import { CaptionSizeSelect } from "./CaptionSizeSelect"

export function CaptionsForm() {
    return (
        <div className="rounded-lg border p-4 space-y-5">
            <CaptionMainInput />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <CaptionSizeSelect />
                <CaptionPositionSelect />
                <CaptionAlignmentSelect />
            </div>
            <CaptionSecondaryInput />
            <CaptionHighlightInput />
        </div>
    )
}
