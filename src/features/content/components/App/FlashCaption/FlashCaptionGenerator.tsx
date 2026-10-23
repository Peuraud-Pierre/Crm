import {
    DialogContent_2,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/shared/ui/atoms/dialog"
import { useContent } from "@/features/content/context/ContentProvider"

import { type MiniApp } from "../../interface"
import { PreviewGrid } from "../components/PreviewGrid"
import { Form } from "./components/Form"
import { FlashCaptionHeader } from "./components/Header"
import { SubmitButton } from "./components/SubmitButton"
import { UploadSection } from "./components/UploadSection"

export function FlashCaptionGenerator({ MiniApp }: { MiniApp: MiniApp }) {
    const { htmlResult, setOpenDialog, selectedFiles, handleSend, formData } =
        useContent()

    return (
        <DialogContent_2 onInteractOutside={(e) => e.preventDefault()}>
            <DialogHeader>
                <DialogTitle>Flash Caption</DialogTitle>
                <DialogDescription>
                    Ajoutez un slogan court sur votre visuel en un instant.
                </DialogDescription>
            </DialogHeader>
            {htmlResult ? (
                <>
                    <FlashCaptionHeader MiniApp={MiniApp} />
                    <iframe
                        title="Flash Caption"
                        srcDoc={htmlResult}
                        className="w-full h-[calc(100vh-2.25rem)] border-0 block"
                    />
                </>
            ) : (
                <div className="space-y-6 p-4 max-h-[90vh]">
                    <Form />
                    <UploadSection MiniApp={MiniApp} />
                    {selectedFiles.length > 0 && <PreviewGrid />}
                    <SubmitButton
                        onClick={async () => {
                            await handleSend(MiniApp.id)
                            setOpenDialog(0)
                        }}
                        disabled={
                            formData.captionSubmitting ||
                            selectedFiles.length === 0
                        }
                    />
                </div>
            )}
        </DialogContent_2>
    )
}
