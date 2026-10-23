import { Label } from "@/shared/ui/atoms/label"
import { useContent } from "@/features/content/context/ContentProvider"
import { X } from "lucide-react"

export function PreviewGrid() {
    const { selectedFiles, setSelectedFiles } = useContent()
    if (selectedFiles.length === 0) return null

    return (
        <div className="space-y-2">
            <Label className="text-sm font-medium">
                Selected files ({selectedFiles.length})
            </Label>
            <div className="grid grid-cols-2 gap-2">
                {selectedFiles.map((file, index) => (
                    <div
                        key={`${file.name}-${file.size}-${file.lastModified}`}
                        className="relative group"
                    >
                        <img
                            src={URL.createObjectURL(file)}
                            alt={`Preview ${index + 1}`}
                            className="w-full h-20 object-cover rounded border"
                        />
                        <button
                            onClick={() =>
                                setSelectedFiles((prev) =>
                                    prev.filter((_, i) => i !== index)
                                )
                            }
                            className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <X className="w-3 h-3" />
                        </button>
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                            {file.name}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    )
}
