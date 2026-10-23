import type { MiniApp } from "@/features/content/components/interface"
import { useContent } from "@/features/content/context/ContentProvider"
import { handleFileSelect, triggerFilePicker, fileConstraints } from "../../../Utils"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"
import { Upload } from "lucide-react"

export function UploadSection({ MiniApp }: { MiniApp: MiniApp }) {
    const { fileInputRefs, setSelectedFiles, toast } = useContent()

    return (
        <div className="space-y-4">
            <Label className="text-sm font-medium">Photo du vêtement</Label>
            <div className="border-2 border-dashed border-muted rounded-lg p-6 text-center">
                <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground mb-3">
                    Sélectionnez une photo claire du vêtement
                </p>
                <Input
                    type="file"
                    accept={fileConstraints.allowedTypes.join(",")}
                    multiple={false}
                    onChange={(e) =>
                        handleFileSelect(toast, e, false, setSelectedFiles)
                    }
                    ref={(el) => {
                        fileInputRefs.current[MiniApp.id] = el
                    }}
                    className="hidden"
                    id={`file-upload-${MiniApp.id}`}
                />
                <Button
                    variant="outline"
                    className="h-11 px-4"
                    onClick={() => triggerFilePicker(fileInputRefs, MiniApp.id)}
                >
                    <Upload className="w-4 h-4 mr-2" />
                    Ajouter une photo
                </Button>
            </div>
        </div>
    )
}
