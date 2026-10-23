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
import { StudioFripesHeader } from "./components/Header"
import { SubmitButton } from "./components/SubmitButton"
import { UploadSection } from "./components/UploadSection"

export function StudioFripesGenerator({ MiniApp }: { MiniApp: MiniApp }) {
    const { htmlResult, handleSend, formData, selectedFiles, setOpenDialog } =
        useContent()

    return (
        <DialogContent_2 onInteractOutside={(e) => e.preventDefault()}>
            <DialogHeader>
                <DialogTitle>Studio Fripes — Result</DialogTitle>
                <DialogDescription>
                    Sublimez vos pièces avec styles.
                </DialogDescription>
            </DialogHeader>
            {htmlResult ? (
                <>
                    <StudioFripesHeader />
                    <iframe
                        title="Studio Fripes Result"
                        srcDoc={htmlResult}
                        // eslint-disable-next-line nokk-project/no-restricted-syntax -- couleur de donnée métier / rendu canvas : non tokenisable (design system §12.4)
                        className="w-full h-[calc(100vh-2.5rem)] border-0 block bg-[#f0f0f0]"
                    />
                </>
            ) : (
                <div className="max-h-[90vh] overflow-y-auto p-4 space-y-6">
                    <Form />
                    <UploadSection MiniApp={MiniApp} />
                    {selectedFiles.length > 0 && <PreviewGrid />}
                    <SubmitButton
                        onClick={async () => {
                            await handleSend(MiniApp.id)
                            setOpenDialog(0)
                        }}
                        disabled={formData.enhancerSubmitting}
                    />
                </div>
            )}
        </DialogContent_2>
    )
}
