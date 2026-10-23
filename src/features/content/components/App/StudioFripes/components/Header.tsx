import { DialogTitle } from "@/shared/ui/atoms/dialog"

export function StudioFripesHeader() {
    return (
        <div className="flex items-start justify-between gap-3 border-b px-3 py-2">
            <div className="space-y-0.5">
                <DialogTitle className="!text-base font-semibold">
                    Studio Fripes — Result
                </DialogTitle>
                <p className="text-xs text-muted-foreground text-left">
                    Close this window to return to the form.
                </p>
            </div>
        </div>
    )
}
