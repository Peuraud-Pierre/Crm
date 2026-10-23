import { CaptionAlignmentSelect } from "../../components/Form/CaptionAlignmentSelect"
import { CaptionHighlightInput } from "../../components/Form/CaptionHighlightInput"
import { CaptionMainInput } from "../../components/Form/CaptionMainInput"
import { CaptionPositionSelect } from "../../components/Form/CaptionPositionSelect"
import { CaptionSecondaryInput } from "../../components/Form/CaptionSecondaryInput"
import { CaptionSizeSelect } from "../../components/Form/CaptionSizeSelect"
import { LogoSelect } from "../../components/Form/LogoSelect"

export function Form() {
    return (
        <div className="space-y-6">
            <CaptionMainInput />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <CaptionSizeSelect />
                <CaptionPositionSelect />
                <CaptionAlignmentSelect />
            </div>

            <CaptionSecondaryInput />

            <CaptionHighlightInput />

            <LogoSelect />
        </div>
    )
}
