import {
    DialogContent_2,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/shared/ui/atoms/dialog"
import { useContent } from "@/features/content/context/ContentProvider"

import { type MiniApp } from "../../interface"
import { PreviewGrid } from "../components/PreviewGrid"
import { AudioSwitch } from "./components/AudioSwitch"
import { CaptionsForm } from "./components/CaptionsForm/CaptionsForm"
import { CaptionsSwitch } from "./components/CaptionsSwitch"
import { Form } from "./components/Form"
import { CinemagiqueHeader } from "./components/Header"
import { SubmitButton } from "./components/SubmitButton"
import { UploadSection } from "./components/UploadSection"

export function CinemagiqueGenerator({ MiniApp }: { MiniApp: MiniApp }) {
    const {
        htmlResult,
        handleSend,
        formData,
        selectedFiles,
        setOpenDialog,
    } = useContent()

    return (
        <DialogContent_2 onInteractOutside={(e) => e.preventDefault()}>
            {htmlResult ? (
                <>
                    <CinemagiqueHeader MiniApp={MiniApp} />
                    <iframe
                        title="Cinémagique"
                        srcDoc={htmlResult}
                        className="w-full h-full border-0 block"
                    />
                </>
            ) : (
                <div className="max-h-[90vh] overflow-y-auto p-4 space-y-5">
                    <DialogHeader>
                        <DialogTitle>Cinémagique</DialogTitle>
                        <DialogDescription>
                            Générez une courte vidéo immersive à partir d'une
                            photo.
                        </DialogDescription>
                    </DialogHeader>

                    <Form />
                    <AudioSwitch />
                    <CaptionsSwitch />

                    {formData.includeCaptions && <CaptionsForm />}

                    <UploadSection MiniApp={MiniApp} />
                    {selectedFiles.length > 0 && <PreviewGrid />}

                    <SubmitButton
                        onClick={async () => {
                            await handleSend(MiniApp.id)
                            setOpenDialog(0)
                        }}
                        disabled={formData.videoSubmitting}
                    />
                </div>
            )}
        </DialogContent_2>
    )
}
