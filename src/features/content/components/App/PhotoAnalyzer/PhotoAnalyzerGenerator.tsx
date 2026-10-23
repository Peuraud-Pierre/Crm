import {
    DialogContent_2,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/shared/ui/atoms/dialog"
import { useContent } from "@/features/content/context/ContentProvider"

import { type MiniApp } from "../../interface"
import { PreviewGrid } from "../components/PreviewGrid"
import { Form } from "./components/Form/Form"
import { PhotoAnalyzerHeader } from "./components/Header"
import { SubmitButton } from "./components/SubmitButton"
import { UploadSection } from "./components/UploadSection"

export function PhotoAnalyzerGenerator({ MiniApp }: { MiniApp: MiniApp }) {
    const { htmlResult, setOpenDialog, selectedFiles, handleSend, formData } =
        useContent()

    return (
        <DialogContent_2 onInteractOutside={(e) => e.preventDefault()}>
            <DialogHeader>
                <DialogTitle>Analyser une photo</DialogTitle>
                <DialogDescription>
                    Uploadez une ou plusieurs photos pour obtenir des analyses.
                </DialogDescription>
            </DialogHeader>
            {htmlResult ? (
                <>
                    <PhotoAnalyzerHeader MiniApp={MiniApp} />
                    <iframe
                        title="Photo Analyzer"
                        srcDoc={htmlResult}
                        className="w-full h-[calc(100vh-2.25rem)] border-0 block"
                    />
                </>
            ) : (
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
                            formData.videoSubmitting ||
                            selectedFiles.length === 0
                        }
                    />
                </div>
            )}
        </DialogContent_2>
    )
}
