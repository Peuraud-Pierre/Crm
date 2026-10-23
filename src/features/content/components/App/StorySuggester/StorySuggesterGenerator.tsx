import {
    DialogContent_2,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/shared/ui/atoms/dialog"
import { useContent } from "@/features/content/context/ContentProvider"
import type { MiniApp } from "../../interface"
import { PreviewGrid } from "../components/PreviewGrid"
import { Form } from "./components/Form"
import { SubmitButton } from "./components/SubmitButton"
import { UploadSection } from "./components/UploadSection"

export function StorySuggesterGenerator({ MiniApp }: { MiniApp: MiniApp }) {
    const { setOpenDialog, selectedFiles, handleSend, formData } = useContent()

    return (
        <DialogContent_2 onInteractOutside={(e) => e.preventDefault()}>
            <DialogHeader>
                <DialogTitle>Story Creator</DialogTitle>
                <DialogDescription>
                    Analysez une photo et obtenez des suggestions de texte story avec style et hashtags.
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 p-4 max-h-[90vh] overflow-y-auto">
                <Form />
                <UploadSection MiniApp={MiniApp} />
                {selectedFiles.length > 0 && <PreviewGrid />}
                <SubmitButton
                    onClick={async () => {
                        await handleSend(MiniApp.id)
                        setOpenDialog(0)
                    }}
                    disabled={
                        formData.Submitting || selectedFiles.length === 0
                    }
                />
            </div>
        </DialogContent_2>
    )
}
