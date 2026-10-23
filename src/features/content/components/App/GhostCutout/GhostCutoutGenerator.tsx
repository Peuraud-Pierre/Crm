import {
    DialogContent_2,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/shared/ui/atoms/dialog"
import { useContent } from "@/features/content/context/ContentProvider"

import { type MiniApp } from "../../interface"
import { PreviewGrid } from "../components/PreviewGrid"
import { GhostCutoutHeader } from "./components/Header"
import { SubmitButton } from "./components/SubmitButton"
import { UploadSection } from "./components/UploadSection"

export function GhostCutoutGenerator({ MiniApp }: { MiniApp: MiniApp }) {
    const { htmlResult, handleSend, formData, selectedFiles } = useContent()

    return (
        <DialogContent_2 onInteractOutside={(e) => e.preventDefault()}>
            <DialogHeader>
                <DialogTitle>Détourage Fantôme</DialogTitle>
                <DialogDescription>
                    Isoler automatiquement un élément précis avec transparence.
                </DialogDescription>
            </DialogHeader>
            {htmlResult ? (
                <>
                    <GhostCutoutHeader MiniApp={MiniApp} />
                    <iframe
                        title="Ghost Cutout Result"
                        srcDoc={htmlResult}
                        className="w-full h-[calc(100vh-2.25rem)] border-0 block"
                    />
                </>
            ) : (
                <div className="space-y-5">
                    <UploadSection MiniApp={MiniApp} />
                    {selectedFiles.length > 0 && <PreviewGrid />}
                    <SubmitButton
                        onClick={() => handleSend(MiniApp.id)}
                        disabled={
                            formData.cutoutSubmitting ||
                            selectedFiles.length === 0
                        }
                    />
                </div>
            )}
        </DialogContent_2>
    )
}
