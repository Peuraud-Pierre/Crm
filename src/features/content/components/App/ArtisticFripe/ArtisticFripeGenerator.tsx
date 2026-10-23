import { DialogContent_2 } from "@/shared/ui/atoms/dialog"
import { useContent } from "@/features/content/context/ContentProvider"

import type { MiniApp } from "../../interface"
import { PreviewGrid } from "../components/PreviewGrid"
import { Form } from "./components/Form"
import { ArtisticFripeHeader } from "./components/Header"
import { SubmitButton } from "./components/SubmitButton"
import { UploadSection } from "./components/UploadSection"

export interface ArtisticFripeProps {
    MiniApp: MiniApp
}

export function ArtisticFripeGenerator({ MiniApp }: { MiniApp: MiniApp }) {
    const { htmlResult, handleSend, formData, selectedFiles, setOpenDialog } =
        useContent()

    return (
        <DialogContent_2 onInteractOutside={(e) => e.preventDefault()}>
            {htmlResult ? (
                <>
                    <ArtisticFripeHeader />
                    <iframe
                        title="Artistic Fripe Result"
                        srcDoc={htmlResult}
                        className="w-full h-[calc(100vh-2.5rem)] border-0 block"
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
                        disabled={formData.artisticSubmitting}
                    />
                </div>
            )}
        </DialogContent_2>
    )
}
