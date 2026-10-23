import { Button } from "@/shared/ui/atoms/button"
import { DialogTitle } from "@/shared/ui/atoms/dialog"
import { useContent } from "@/features/content/context/ContentProvider"
import { X } from "lucide-react"

import { type MiniApp } from "../../../interface"

export function GhostCutoutHeader({ MiniApp }: { MiniApp: MiniApp }) {
    const { setHtmlResult, setOpenDialog } = useContent()

    return (
        <div className="flex items-center justify-between gap-2 bg-background px-3 py-1.5 border-b">
            <DialogTitle className="flex items-center gap-2 !text-base font-semibold [&>svg]:h-5 [&>svg]:w-5">
                {MiniApp.icon}
                <span>{MiniApp.title}</span>
            </DialogTitle>
            <Button
                variant="destructive"
                size="sm"
                className="h-8 px-3"
                onClick={() => {
                    setHtmlResult(null)
                    setOpenDialog(null)
                }}
            >
                <X className="w-5 h-5 mr-2" /> Close
            </Button>
        </div>
    )
}
