import { type MiniApp } from "@/features/content/components/interface"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"
import { useContent } from "@/features/content/context/ContentProvider"
import { fileConstraints } from "../../../Utils"
import { Upload } from "lucide-react"

import { handleFileSelect } from "../../../Utils"

export function UploadSection({ MiniApp }: { MiniApp: MiniApp }) {
    const { fileInputRefs, setSelectedFiles, toast, triggerFilePicker } =
        useContent()

    return (
        <div className="space-y-3">
            <Label className="text-sm font-medium">
                Upload a photo (front/back)
            </Label>

            <div className="border-2 border-dashed border-muted rounded-xl p-5 text-center">
                <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground mb-3">
                    Select a single photo
                </p>

                <Input
                    type="file"
                    accept={fileConstraints.allowedTypes.join(",")}
                    multiple={false}
                    onChange={(e) =>
                        handleFileSelect(toast, e, false, setSelectedFiles, 1)
                    }
                    ref={(element) => {
                        fileInputRefs.current[MiniApp.id] = element
                    }}
                    className="hidden"
                    id={`file-upload-${MiniApp.id}`}
                />

                <Button
                    variant="outline"
                    className="h-11 px-4"
                    onClick={() => triggerFilePicker(MiniApp.id)}
                >
                    <Upload className="w-4 h-4 mr-2" />
                    Add a photo
                </Button>
            </div>
        </div>
    )
}
